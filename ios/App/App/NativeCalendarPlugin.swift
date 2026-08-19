import Capacitor
import EventKit
import EventKitUI
import UIKit

/// Adds an event to the phone's own Calendar app.
///
/// Presents `EKEventEditViewController`, the system "New Event" sheet, with the
/// competition prefilled. The user taps Add and it lands in whichever calendar
/// they keep their events in.
///
/// All-day events are anchored to the local start of day here. Android anchors
/// them differently, which is why the web layer sends a plain "YYYY-MM-DD"
/// string and lets each platform place it.
@objc(NativeCalendarPlugin)
public class NativeCalendarPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeCalendarPlugin"
    public let jsName = "NativeCalendar"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "addEvent", returnType: CAPPluginReturnPromise),
    ]

    private let eventStore = EKEventStore()
    private var pendingCall: CAPPluginCall?

    /// Only proves the plugin exists in this binary. A binary built before this
    /// plugin existed has no bridge entry, so the JS call rejects instead of
    /// reaching this method, and the web layer falls back to its own sheet.
    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": true])
    }

    @objc func addEvent(_ call: CAPPluginCall) {
        guard let title = call.getString("title"), !title.isEmpty,
              let startDate = call.getString("startDate"),
              let start = localStartOfDay(startDate) else {
            call.reject("title and startDate are required")
            return
        }

        // Missing end date means a single-day competition. EventKit treats an
        // all-day event's end date as inclusive, so the last day is passed as is.
        let end = localStartOfDay(call.getString("endDate") ?? startDate) ?? start

        // From iOS 17 the edit sheet saves out of process and needs no calendar
        // authorization at all. Asking anyway is worse than pointless there:
        // requestAccess(to:) does not prompt on iOS 17 and throws instead.
        if #available(iOS 17.0, *) {
            presentEditor(call: call, title: title, start: start, end: end)
            return
        }

        requestLegacyAccess { [weak self] granted in
            guard let self = self else { return }
            guard granted else {
                call.reject("PERMISSION_DENIED")
                return
            }
            self.presentEditor(call: call, title: title, start: start, end: end)
        }
    }

    /// iOS 14 to 16 only. Marked deprecated alongside the API it calls so the
    /// iOS 17 SDK does not warn at the call site.
    @available(iOS, introduced: 13.0, deprecated: 17.0)
    private func requestLegacyAccess(_ completion: @escaping (Bool) -> Void) {
        eventStore.requestAccess(to: .event) { granted, _ in
            completion(granted)
        }
    }

    private func presentEditor(call: CAPPluginCall, title: String, start: Date, end: Date) {
        DispatchQueue.main.async {
            let event = EKEvent(eventStore: self.eventStore)
            event.title = title
            event.isAllDay = true
            event.startDate = start
            event.endDate = end
            event.location = call.getString("location")
            event.notes = call.getString("notes")

            // Deliberately not setting event.calendar: reading
            // defaultCalendarForNewEvents needs calendar access, which we never
            // request on iOS 17+, so it would be nil there anyway. The edit sheet
            // picks the user's default calendar itself.

            if let urlString = call.getString("url"), let url = URL(string: urlString) {
                event.url = url
            }

            guard let presenter = self.topMostViewController() else {
                call.reject("NO_PRESENTER")
                return
            }

            // A second call while a sheet is still up would orphan the first
            // promise. Settle it before taking ownership.
            self.pendingCall?.resolve(["saved": false])

            let controller = EKEventEditViewController()
            controller.event = event
            controller.eventStore = self.eventStore
            controller.editViewDelegate = self

            self.pendingCall = call
            presenter.present(controller, animated: true, completion: nil)
        }
    }

    /// Presenting from a controller that already has something presented fails
    /// silently, which would leave the JS promise hanging forever. Walk down to
    /// the leaf so an open in-app browser or modal does not swallow the sheet.
    private func topMostViewController() -> UIViewController? {
        var controller = bridge?.viewController
        while let presented = controller?.presentedViewController {
            controller = presented
        }
        return controller
    }

    /// "YYYY-MM-DD" to the local start of that day, the anchor EventKit expects
    /// for an all-day event.
    private func localStartOfDay(_ isoDate: String) -> Date? {
        let parts = isoDate.split(separator: "-")
        guard parts.count == 3,
              let year = Int(parts[0]),
              let month = Int(parts[1]),
              let day = Int(parts[2]) else {
            return nil
        }

        var components = DateComponents()
        components.year = year
        components.month = month
        components.day = day

        return Calendar.current.date(from: components)
    }
}

extension NativeCalendarPlugin: EKEventEditViewDelegate {
    public func eventEditViewController(
        _ controller: EKEventEditViewController,
        didCompleteWith action: EKEventEditViewAction
    ) {
        let call = pendingCall
        pendingCall = nil

        controller.dismiss(animated: true) {
            // Cancelling is a normal outcome, not an error: the web layer only
            // needs to know whether an event was actually saved.
            call?.resolve(["saved": action == .saved])
        }
    }
}
