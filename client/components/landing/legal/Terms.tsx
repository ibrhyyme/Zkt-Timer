import React from 'react';
import './Legal.scss';
import block from '../../../styles/bem';

const b = block('landing-legal');

export default function Terms() {
	return (
		<div className={b()}>
			<h1>Kullanıcı Sözleşmesi</h1>
			<p>Son güncelleme: 9 Şubat 2026</p>

			<p>
				Lütfen Zkt-Timer ("Platform") hizmetlerini kullanmadan önce bu Kullanıcı Sözleşmesi'ni ("Sözleşme")
				dikkatlice okuyunuz. Platforma erişmeniz veya kullanmanız, bu Sözleşme'yi kabul ettiğiniz anlamına
				gelir.
			</p>

			<h2>1. Taraflar</h2>
			<p>
				Bu Sözleşme, Zkt-Timer ile Platformu kullanan kullanıcı ("Kullanıcı") arasında akdedilmiştir.
			</p>

			<h2>2. Hizmetin Kapsamı</h2>
			<p>
				Zkt-Timer, kullanıcılarına online hız bardağı/küp zamanlayıcısı, istatistik takibi, algoritmalar ve
				ilgili eğitim araçlarını sunan bir platformdur. Platform, "olduğu gibi" (as-is) sunulmakta olup,
				kesintisiz veya hatasız olacağı garanti edilmemektedir.
			</p>

			<h2>3. Üyelik ve Kullanım Şartları</h2>
			<ul>
				<li>
					Kullanıcı, Platforma üye olurken verdiği bilgilerin doğru ve güncel olduğunu beyan eder.
				</li>
				<li>
					18 yaşından küçük kullanıcıların, Platformu kullanmak için ebeveyn veya yasal vasi iznini almış
					olması gerekmektedir.
				</li>
				<li>
					Kullanıcı, Platformu yalnızca hukuka uygun amaçlarla kullanabilir. Platformun güvenliğini tehdit
					edecek, diğer kullanıcılara zarar verecek veya sistemin işleyişini bozacak faaliyetlerde bulunamaz.
				</li>
				<li>
					Hesap güvenliğinden (şifre vb.) Kullanıcı bizzat sorumludur. Hesabın yetkisiz kullanımı durumunda
					derhal Platforma bildirimde bulunulmalıdır.
				</li>
				<li>
					Zkt-Timer, herhangi bir gerekçe göstermeksizin Kullanıcı'nın üyeliğini askıya alma veya sonlandırma
					hakkını saklı tutar.
				</li>
			</ul>

			<h2>4. Fikri Mülkiyet Hakları</h2>
			<p>
				Platformda yer alan tüm yazılım, tasarım, içerik, görseller ve markalar Zkt-Timer'a veya lisans
				verenlerine aittir. Kullanıcılar, bu içerikleri kopyalayamaz, çoğaltamaz, dağıtamaz veya ticari amaçla
				kullanamaz.
			</p>

			<h2>5. Sorumluluk Reddi</h2>
			<p>
				Zkt-Timer, Platformun kullanımı sırasında oluşabilecek veri kayıpları, bağlantı hataları veya donanım
				uyuşmazlıklarından sorumlu tutulamaz. Üçüncü taraf bağlantılarına (linkler) erişim Kullanıcı'nın kendi
				sorumluluğundadır.
			</p>

			<h2>6. Ücretli Hizmetler ve İadeler</h2>
			<p>
				Platform üzerindeki bazı hizmetler ücretli olabilir. Ödemeler, güvenli ödeme altyapıları (örn. Stripe)
				aracılığıyla gerçekleştirilir. Dijital içerik ve hizmetler doğası gereği anında ifa edildiğinden, yasal
				zorunluluklar saklı kalmak kaydıyla ücret iadesi yapılmayabilir.
			</p>

			<h2>7. Sözleşme Değişiklikleri</h2>
			<p>
				Zkt-Timer, bu Sözleşme'yi dilediği zaman güncelleme hakkını saklı tutar. Güncellenen şartlar,
				Platformda yayınlandığı tarihte yürürlüğe girer. Kullanıcıların periyodik olarak bu sayfayı kontrol
				etmesi önerilir.
			</p>

			<h2>8. Uyuşmazlık Çözümü</h2>
			<p>
				İşbu Sözleşme'den doğacak uyuşmazlıklarda Türk Hukuku uygulanacak olup, ilgili Mahkemeler ve İcra
				Daireleri yetkilidir.
			</p>

			<h2>9. İletişim</h2>
			<p>
				Sözleşme ile ilgili her türlü soru ve öneriniz için{' '}
				<a href="mailto:ibrhyyme@icloud.com">ibrhyyme@icloud.com</a> adresi üzerinden bizimle iletişime
				geçebilirsiniz.
			</p>
		</div>
	);
}
