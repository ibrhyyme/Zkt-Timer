# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# Capacitor ProGuard Rules
-keep public class com.getcapacitor.BridgeActivity { *; }
-keep public class com.getcapacitor.Plugin { *; }
-keep public class * extends com.getcapacitor.Plugin
-keep public class com.getcapacitor.PluginMethod { *; }
-keep public class com.getcapacitor.MessageHandler { *; }
-keep public class com.getcapacitor.BridgeWebViewClient { *; }
-keep public class com.getcapacitor.WebViewLocalServer { *; }

# RevenueCat
-keep class com.revenuecat.purchases.** { *; }
-dontwarn com.revenuecat.purchases.**

# Google Play Billing Library + Firebase
-keep class com.android.billingclient.** { *; }
-keep class com.google.android.gms.** { *; }
-keep class com.google.firebase.** { *; }
-dontwarn com.android.billingclient.**
-dontwarn com.google.firebase.**

# Kotlin reflection / serialization / coroutines (RevenueCat ve Capacitor kullanıyor)
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes InnerClasses
-keepattributes EnclosingMethod
-keep class kotlin.Metadata { *; }
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-keepclassmembers class kotlinx.** { *; }

# OkHttp / Okio (RevenueCat dependency)
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**

# Gson / serialization models (RevenueCat kullanıyor)
-keepclassmembers,allowobfuscation class * {
  @com.google.gson.annotations.SerializedName <fields>;
}
-keep class com.google.gson.reflect.TypeToken { *; }
-keep class * extends com.google.gson.reflect.TypeToken

# Capacitor RevenueCat plugin (reflection-based)
-keep class com.revenuecat.purchases.capacitor.** { *; }

