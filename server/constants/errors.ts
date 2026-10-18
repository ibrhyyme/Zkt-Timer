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
	EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
	// The caller sent too many requests in a short window. Expected, so it is
	// delivered to the client as-is instead of being masked as a server error.
	RATE_LIMITED = 'RATE_LIMITED',
	// A service we read from (the ZKT federation) is temporarily unreachable and
	// nothing cached can stand in. The client retries on its own.
	UPSTREAM_UNAVAILABLE = 'UPSTREAM_UNAVAILABLE',
}
