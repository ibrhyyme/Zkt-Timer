import React from 'react';
import './Legal.scss';
import block from '../../../styles/bem';

const b = block('landing-legal');

export default function Privacy() {
	return (
		<div className={b()}>
			<h1>Gizlilik Politikası ve KVKK Aydınlatma Metni</h1>
			<p>Son güncelleme: 9 Şubat 2026</p>

			<p>
				Zkt-Timer ("Platform", "Biz") olarak, kullanıcılarımızın ("Kullanıcı", "Siz") kişisel verilerinin
				güvenliğine ve gizliliğine büyük önem veriyoruz. Bu metin, 6698 sayılı Kişisel Verilerin Korunması
				Kanunu ("KVKK") ve ilgili mevzuat uyarınca kişisel verilerinizin işlenmesi, saklanması ve aktarılması
				hakkında sizleri aydınlatmak amacıyla hazırlanmıştır.
			</p>

			<p>Platformumuzu kullanarak, bu Gizlilik Politikasını ve KVKK Aydınlatma Metnini kabul etmiş sayılırsınız.</p>

			<h2>1. Veri Sorumlusu</h2>
			<p>
				KVKK uyarınca, kişisel verileriniz; Zkt-Timer Platformu tarafından veri sorumlusu sıfatıyla aşağıda
				açıklanan kapsamda işlenebilecektir.
			</p>

			<h2>2. Kişisel Verilerin İşlenme Amacı</h2>
			<p>Kişisel verileriniz aşağıdaki amaçlarla işlenmektedir:</p>
			<ul>
				<li>Platform üyelik işlemlerinin gerçekleştirilmesi.</li>
				<li>Sunduğumuz hizmetlerin (zamanlayıcı, istatistikler, analizler) sağlanması ve iyileştirilmesi.</li>
				<li>
					Kullanıcı deneyiminin kişiselleştirilmesi, hesap güvenliğinin sağlanması ve teknik sorunların
					giderilmesi.
				</li>
				<li>
					Yasal yükümlülüklerin yerine getirilmesi (örneğin; trafik verilerinin saklanması, 5651 sayılı kanun
					gereklilikleri).
				</li>
				<li>İletişim faaliyetlerinin yürütülmesi ve destek taleplerinin yanıtlanması.</li>
				<li>Pazarlama ve analiz süreçlerinin (çerezler yoluyla) yönetilmesi.</li>
			</ul>

			<h2>3. İşlenen Kişisel Verileriniz</h2>
			<p>Platform üzerinden aşağıdaki kategorilerde verileriniz toplanabilir:</p>
			<ul>
				<li>
					<strong>Kimlik Bilgileri:</strong> Ad, soyad (varsa), kullanıcı adı.
				</li>
				<li>
					<strong>İletişim Bilgileri:</strong> E-posta adresi.
				</li>
				<li>
					<strong>İşlem Güvenliği Bilgileri:</strong> IP adresi, şifre bilgileri (hashlenmiş olarak), giriş-çıkış
					kayıtları.
				</li>
				<li>
					<strong>Kullanım Verileri:</strong> Çözüm süreleri, istatistikler, platform içi aktiviteler.
				</li>
			</ul>

			<h2>4. Kişisel Verilerin Toplanma Yöntemi ve Hukuki Sebebi</h2>
			<p>
				Kişisel verileriniz; web sitemiz, mobil uygulamalarımız veya e-posta yoluyla elektronik ortamda
				otomatik yollarla toplanmaktadır. Bu veriler KVKK m.5/2'de belirtilen;
			</p>
			<ul>
				<li>Kanunlarda açıkça öngörülmesi,</li>
				<li>Bir sözleşmenin kurulması veya ifasıyla doğrudan doğruya ilgili olması,</li>
				<li>Veri sorumlusunun hukuki yükümlülüğünü yerine getirebilmesi,</li>
				<li>
					İlgili kişinin temel hak ve özgürlüklerine zarar vermemek kaydıyla, veri sorumlusunun meşru
					menfaatleri için veri işlenmesinin zorunlu olması,
				</li>
			</ul>
			<p>hukuki sebeplerine dayanılarak işlenmektedir.</p>

			<h2>5. Kişisel Verilerin Aktarılması</h2>
			<p>Kişisel verileriniz, yasal düzenlemelerin öngördüğü kapsamda ve amaçlarla sınırlı olarak;</p>
			<ul>
				<li>
					Hizmetlerimizi sunmak için kullandığımız altyapı sağlayıcıları (örn. AWS, Sunucu hizmetleri),
				</li>
				<li>Ödeme işlemleri için anlaşmalı ödeme kuruluşları (örn. Stripe),</li>
				<li>E-posta gönderimi için servis sağlayıcıları (örn. AWS SES, Resend),</li>
				<li>
					Analiz ve performans takibi için kullandığımız üçüncü parti araçlar (örn. Google Analytics,
					Sentry),
				</li>
				<li>Talep edilmesi halinde yetkili kamu kurum ve kuruluşları,</li>
			</ul>
			<p>ile KVKK m.8 ve m.9'a uygun olarak paylaşılabilir.</p>

			<p>
				Sunucularımızın ve kullandığımız bazı hizmetlerin yurt dışında bulunması nedeniyle, verileriniz açık
				rızanıza veya KVKK m.9'daki diğer şartlara dayalı olarak yurt dışına aktarılabilir.
			</p>

			<h2>6. İlgili Kişinin Hakları</h2>
			<p>KVKK m.11 uyarınca, veri sahibi olarak aşağıdaki haklara sahipsiniz:</p>
			<ul>
				<li>Kişisel verinizin işlenip işlenmediğini öğrenme,</li>
				<li>Kişisel verileriniz işlenmişse buna ilişkin bilgi talep etme,</li>
				<li>
					Kişisel verilerin işlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme,
				</li>
				<li>Yurt içinde veya yurt dışında kişisel verilerin aktarıldığı üçüncü kişileri bilme,</li>
				<li>Kişisel verilerin eksik veya yanlış işlenmiş olması hâlinde bunların düzeltilmesini isteme,</li>
				<li>KVKK m.7 çerçevesinde kişisel verilerin silinmesini veya yok edilmesini isteme,</li>
				<li>İşlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme,</li>
				<li>Kişisel verilerin kanuna aykırı olarak işlenmesi sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme.</li>
			</ul>
			<p>
				Bu haklarınızı kullanmak için bizimle{' '}
				<a href="mailto:ibrhyyme@icloud.com">ibrhyyme@icloud.com</a> adresinden iletişime geçebilirsiniz.
			</p>

			<hr />

			<h1>Çerez Politikası (Cookie Policy)</h1>
			<p>
				Zkt-Timer olarak, kullanıcı deneyimini iyileştirmek ve hizmet kalitemizi artırmak amacıyla çerezler
				(cookies) kullanmaktayız.
			</p>

			<h2>1. Çerez Nedir?</h2>
			<p>
				Çerezler, ziyaret ettiğiniz web siteleri tarafından tarayıcınız aracılığıyla cihazınıza veya ağ
				sunucusuna depolanan küçük metin dosyalarıdır.
			</p>

			<h2>2. Kullanılan Çerez Türleri</h2>
			<ul>
				<li>
					<strong>Zorunlu Çerezler:</strong> Web sitesinin düzgün çalışması için gereklidir (örneğin; oturum
					açma, güvenlik). Bu çerezler olmadan site özelliklerini kullanamazsınız.
				</li>
				<li>
					<strong>Performans ve Analiz Çerezleri:</strong> Sitemizi nasıl kullandığınızı analiz ederek
					performansı artırmamıza yardımcı olur (örn. Google Analytics). Bu veriler anonim olarak toplanır.
				</li>
				<li>
					<strong>İşlevsellik Çerezleri:</strong> Dil tercihleri veya kullanıcı ayarlarını hatırlamak için
					kullanılır.
				</li>
			</ul>

			<h2>3. Çerezlerin Yönetimi</h2>
			<p>
				Tarayıcı ayarlarınızı değiştirerek çerezleri reddedebilir veya silebilirsiniz. Ancak, çerezleri devre
				dışı bırakmanız durumunda sitemizin bazı özellikleri (örn. oturum açık kalma) düzgün çalışmayabilir.
			</p>

			<p>
				Daha fazla bilgi veya sorularınız için{' '}
				<a href="mailto:ibrhyyme@icloud.com">ibrhyyme@icloud.com</a> adresine e-posta gönderebilirsiniz.
			</p>
		</div>
	);
}
