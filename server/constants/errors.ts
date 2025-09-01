export enum ErrorMessage {
	INVALID_LOGIN = 'Geçersiz giriş',	
	FORBIDDEN = 'Bu kaynağa erişim yetkiniz yok',
	RESOURCE_NOT_FOUND = 'Kaynak bulunamadı',
	BAD_INPUT = 'Geçersiz giriş',
	BANNED = 'Yasaklandınız',
	NO_ID_IN_INPUT = 'Oluşturma veya güncelleme işlemlerinde ID sağlanamaz',
}

export enum ErrorCode {
	SERVER = 'UNAUTHENTICATED',
	UNAUTHENTICATED = 'UNAUTHENTICATED',
	FORBIDDEN = 'FORBIDDEN',
	NOT_FOUND = 'NOT_FOUND',
	BAD_INPUT = 'BAD_INPUT',
	INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
}
