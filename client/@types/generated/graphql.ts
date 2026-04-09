import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
  /** The `BigInt` scalar type represents non-fractional signed whole numeric values. */
  BigInt: any;
  /** The `Byte` scalar type represents byte value as a Buffer */
  Byte: any;
  /** A field whose value is a Currency: https://en.wikipedia.org/wiki/ISO_4217. */
  Currency: any;
  /** A date string, such as 2007-12-03, compliant with the `full-date` format outlined in section 5.6 of the RFC 3339 profile of the ISO 8601 standard for representation of dates and times using the Gregorian calendar. */
  Date: any;
  /** The javascript `Date` as string. Type represents date and time as the ISO Date string. */
  DateTime: any;
  /**
   * A string representing a duration conforming to the ISO8601 standard,
   * such as: P1W1DT13H23M34S
   * P is the duration designator (for period) placed at the start of the duration representation.
   * Y is the year designator that follows the value for the number of years.
   * M is the month designator that follows the value for the number of months.
   * W is the week designator that follows the value for the number of weeks.
   * D is the day designator that follows the value for the number of days.
   * T is the time designator that precedes the time components of the representation.
   * H is the hour designator that follows the value for the number of hours.
   * M is the minute designator that follows the value for the number of minutes.
   * S is the second designator that follows the value for the number of seconds.
   *
   * Note the time designator, T, that precedes the time value.
   *
   * Matches moment.js, Luxon and DateFns implementations
   * ,/. is valid for decimal places and +/- is a valid prefix
   */
  Duration: any;
  /** A field whose value conforms to the standard internet email address format as specified in HTML Spec: https://html.spec.whatwg.org/multipage/input.html#valid-e-mail-address. */
  EmailAddress: any;
  /** A field whose value is a generic Universally Unique Identifier: https://en.wikipedia.org/wiki/Universally_unique_identifier. */
  GUID: any;
  /** A field whose value is a hex color code: https://en.wikipedia.org/wiki/Web_colors. */
  HexColorCode: any;
  /** A field whose value is a CSS HSL color: https://developer.mozilla.org/en-US/docs/Web/CSS/color_value#hsl()_and_hsla(). */
  HSL: any;
  /** A field whose value is a CSS HSLA color: https://developer.mozilla.org/en-US/docs/Web/CSS/color_value#hsl()_and_hsla(). */
  HSLA: any;
  /** A field whose value is a IPv4 address: https://en.wikipedia.org/wiki/IPv4. */
  IPv4: any;
  /** A field whose value is a IPv6 address: https://en.wikipedia.org/wiki/IPv6. */
  IPv6: any;
  /** A field whose value is a ISBN-10 or ISBN-13 number: https://en.wikipedia.org/wiki/International_Standard_Book_Number. */
  ISBN: any;
  /** The `JSON` scalar type represents JSON values as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
  JSON: any;
  /** The `JSONObject` scalar type represents JSON objects as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
  JSONObject: any;
  /** A field whose value is a JSON Web Token (JWT): https://jwt.io/introduction. */
  JWT: any;
  /** A field whose value is a valid decimal degrees latitude number (53.471): https://en.wikipedia.org/wiki/Latitude */
  Latitude: any;
  /** A local date string (i.e., with no associated timezone) in `YYYY-MM-DD` format, e.g. `2020-01-01`. */
  LocalDate: any;
  /** A local time string (i.e., with no associated timezone) in 24-hr `HH:mm[:ss[.SSS]]` format, e.g. `14:25` or `14:25:06` or `14:25:06.123`.  This scalar is very similar to the `LocalTime`, with the only difference being that `LocalEndTime` also allows `24:00` as a valid value to indicate midnight of the following day.  This is useful when using the scalar to represent the exclusive upper bound of a time block. */
  LocalEndTime: any;
  /** A local time string (i.e., with no associated timezone) in 24-hr `HH:mm[:ss[.SSS]]` format, e.g. `14:25` or `14:25:06` or `14:25:06.123`. */
  LocalTime: any;
  /** The `BigInt` scalar type represents non-fractional signed whole numeric values. */
  Long: any;
  /** A field whose value is a valid decimal degrees longitude number (53.471): https://en.wikipedia.org/wiki/Longitude */
  Longitude: any;
  /** A field whose value is a IEEE 802 48-bit MAC address: https://en.wikipedia.org/wiki/MAC_address. */
  MAC: any;
  /** Floats that will have a value less than 0. */
  NegativeFloat: any;
  /** Integers that will have a value less than 0. */
  NegativeInt: any;
  /** A string that cannot be passed as an empty value */
  NonEmptyString: any;
  /** Floats that will have a value of 0 or more. */
  NonNegativeFloat: any;
  /** Integers that will have a value of 0 or more. */
  NonNegativeInt: any;
  /** Floats that will have a value of 0 or less. */
  NonPositiveFloat: any;
  /** Integers that will have a value of 0 or less. */
  NonPositiveInt: any;
  /** A field whose value conforms with the standard mongodb object ID as described here: https://docs.mongodb.com/manual/reference/method/ObjectId/#ObjectId. Example: 5e5677d71bdc2ae76344968c */
  ObjectID: any;
  /** A field whose value conforms to the standard E.164 format as specified in: https://en.wikipedia.org/wiki/E.164. Basically this is +17895551234. */
  PhoneNumber: any;
  /** A field whose value is a valid TCP port within the range of 0 to 65535: https://en.wikipedia.org/wiki/Transmission_Control_Protocol#TCP_ports */
  Port: any;
  /** Floats that will have a value greater than 0. */
  PositiveFloat: any;
  /** Integers that will have a value greater than 0. */
  PositiveInt: any;
  /** A field whose value conforms to the standard postal code formats for United States, United Kingdom, Germany, Canada, France, Italy, Australia, Netherlands, Spain, Denmark, Sweden, Belgium, India, Austria, Portugal, Switzerland or Luxembourg. */
  PostalCode: any;
  /** A field whose value is a CSS RGB color: https://developer.mozilla.org/en-US/docs/Web/CSS/color_value#rgb()_and_rgba(). */
  RGB: any;
  /** A field whose value is a CSS RGBA color: https://developer.mozilla.org/en-US/docs/Web/CSS/color_value#rgb()_and_rgba(). */
  RGBA: any;
  /** The `SafeInt` scalar type represents non-fractional signed whole numeric values that are considered safe as defined by the ECMAScript specification. */
  SafeInt: any;
  /** A time string at UTC, such as 10:15:30Z, compliant with the `full-time` format outlined in section 5.6 of the RFC 3339profile of the ISO 8601 standard for representation of dates and times using the Gregorian calendar. */
  Time: any;
  /** Floats that will have a value of 0 or more. */
  UnsignedFloat: any;
  /** Integers that will have a value of 0 or more. */
  UnsignedInt: any;
  /** The `Upload` scalar type represents a file upload. */
  Upload: any;
  /** A field whose value conforms to the standard URL format as specified in RFC3986: https://www.ietf.org/rfc/rfc3986.txt. */
  URL: any;
  /** A currency string, such as $21.25 */
  USCurrency: any;
  /** A field whose value is a UTC Offset: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones */
  UtcOffset: any;
  /** A field whose value is a generic Universally Unique Identifier: https://en.wikipedia.org/wiki/Universally_unique_identifier. */
  UUID: any;
  /** Represents NULL values */
  Void: any;
};

export type AdminSendPushResult = {
  __typename?: 'AdminSendPushResult';
  success?: Maybe<Scalars['Boolean']>;
};

export type AdminUserFiltersInput = {
  admin?: InputMaybe<Scalars['Boolean']>;
  banned?: InputMaybe<Scalars['Boolean']>;
  email_verified?: InputMaybe<Scalars['Boolean']>;
  is_pro?: InputMaybe<Scalars['Boolean']>;
  mod?: InputMaybe<Scalars['Boolean']>;
  platforms?: InputMaybe<Array<Scalars['String']>>;
  verified?: InputMaybe<Scalars['Boolean']>;
};

export type AlgorithmOverride = {
  __typename?: 'AlgorithmOverride';
  created_at?: Maybe<Scalars['DateTime']>;
  cube_key?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  name?: Maybe<Scalars['String']>;
  rotate?: Maybe<Scalars['Int']>;
  scrambles?: Maybe<Scalars['String']>;
  solution?: Maybe<Scalars['String']>;
  user_id?: Maybe<Scalars['String']>;
};

export type AlgorithmOverrideInput = {
  cube_key?: InputMaybe<Scalars['String']>;
  name?: InputMaybe<Scalars['String']>;
  rotate?: InputMaybe<Scalars['Int']>;
  scrambles?: InputMaybe<Scalars['String']>;
  solution?: InputMaybe<Scalars['String']>;
};

export type Announcement = {
  __typename?: 'Announcement';
  category?: Maybe<Scalars['String']>;
  content?: Maybe<Scalars['String']>;
  createdAt?: Maybe<Scalars['DateTime']>;
  hasViewed?: Maybe<Scalars['Boolean']>;
  id?: Maybe<Scalars['String']>;
  imageUrl?: Maybe<Scalars['String']>;
  isActive?: Maybe<Scalars['Boolean']>;
  isDraft?: Maybe<Scalars['Boolean']>;
  priority?: Maybe<Scalars['Int']>;
  publishedAt?: Maybe<Scalars['DateTime']>;
  title?: Maybe<Scalars['String']>;
  translations?: Maybe<Scalars['String']>;
  viewCount?: Maybe<Scalars['Int']>;
};

export type AnnouncementFilterInput = {
  category?: InputMaybe<Scalars['String']>;
  isActive?: InputMaybe<Scalars['Boolean']>;
  isDraft?: InputMaybe<Scalars['Boolean']>;
};

export type Badge = {
  __typename?: 'Badge';
  badge_type?: Maybe<BadgeType>;
  badge_type_id?: Maybe<Scalars['String']>;
  created_at?: Maybe<Scalars['DateTime']>;
  id?: Maybe<Scalars['String']>;
  user?: Maybe<PublicUserAccount>;
  user_id?: Maybe<Scalars['String']>;
};

export type BadgeType = {
  __typename?: 'BadgeType';
  color?: Maybe<Scalars['String']>;
  created_at?: Maybe<Scalars['DateTime']>;
  created_by?: Maybe<PublicUserAccount>;
  created_by_id?: Maybe<Scalars['String']>;
  description?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  name?: Maybe<Scalars['String']>;
  priority?: Maybe<Scalars['Int']>;
};

export type BadgeTypeInput = {
  color?: InputMaybe<Scalars['String']>;
  description?: InputMaybe<Scalars['String']>;
  name?: InputMaybe<Scalars['String']>;
  priority?: InputMaybe<Scalars['Int']>;
};

export type BanLog = {
  __typename?: 'BanLog';
  active?: Maybe<Scalars['Boolean']>;
  banned_until?: Maybe<Scalars['DateTime']>;
  banned_user?: Maybe<UserAccountForAdmin>;
  banned_user_id?: Maybe<Scalars['String']>;
  created_at?: Maybe<Scalars['DateTime']>;
  created_by?: Maybe<UserAccountForAdmin>;
  created_by_id?: Maybe<Scalars['String']>;
  forever?: Maybe<Scalars['Boolean']>;
  id?: Maybe<Scalars['String']>;
  minutes?: Maybe<Scalars['Int']>;
  reason?: Maybe<Scalars['String']>;
};

export type BanUserInput = {
  cheating_in_1v1?: InputMaybe<Scalars['Boolean']>;
  delete_published_solves?: InputMaybe<Scalars['Boolean']>;
  minutes?: InputMaybe<Scalars['Int']>;
  reason?: InputMaybe<Scalars['String']>;
  user_id?: InputMaybe<Scalars['String']>;
};

export type BulkEmailResult = {
  __typename?: 'BulkEmailResult';
  failCount?: Maybe<Scalars['Int']>;
  skippedCount?: Maybe<Scalars['Int']>;
  successCount?: Maybe<Scalars['Int']>;
};

export type CreateAnnouncementInput = {
  category?: InputMaybe<Scalars['String']>;
  content?: InputMaybe<Scalars['String']>;
  imageUrl?: InputMaybe<Scalars['String']>;
  isDraft?: InputMaybe<Scalars['Boolean']>;
  notificationPlatforms?: InputMaybe<Array<Scalars['String']>>;
  priority?: InputMaybe<Scalars['Int']>;
  sendNotification?: InputMaybe<Scalars['Boolean']>;
  title?: InputMaybe<Scalars['String']>;
  translations?: InputMaybe<Scalars['String']>;
};

export type CreatePromoCodeInput = {
  code?: InputMaybe<Scalars['String']>;
  duration_minutes?: InputMaybe<Scalars['Int']>;
  max_uses?: InputMaybe<Scalars['Int']>;
  membership_type?: InputMaybe<Scalars['String']>;
};

export type CustomCubeType = {
  __typename?: 'CustomCubeType';
  created_at?: Maybe<Scalars['DateTime']>;
  id?: Maybe<Scalars['String']>;
  name?: Maybe<Scalars['String']>;
  private?: Maybe<Scalars['Boolean']>;
  scramble?: Maybe<Scalars['String']>;
  user_id?: Maybe<Scalars['String']>;
};

export type CustomCubeTypeInput = {
  name?: InputMaybe<Scalars['String']>;
  private?: InputMaybe<Scalars['Boolean']>;
  scramble?: InputMaybe<Scalars['String']>;
};

export type CustomTrainer = {
  __typename?: 'CustomTrainer';
  algo_type?: Maybe<Scalars['String']>;
  alt_solutions?: Maybe<Scalars['String']>;
  colors?: Maybe<Scalars['String']>;
  copy_of?: Maybe<CustomTrainer>;
  copy_of_id?: Maybe<Scalars['String']>;
  created_at?: Maybe<Scalars['DateTime']>;
  cube_type?: Maybe<Scalars['String']>;
  description?: Maybe<Scalars['String']>;
  downloaded?: Maybe<Scalars['Boolean']>;
  group_name?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  key?: Maybe<Scalars['String']>;
  like_count?: Maybe<Scalars['Int']>;
  name?: Maybe<Scalars['String']>;
  private?: Maybe<Scalars['Boolean']>;
  scrambles?: Maybe<Scalars['String']>;
  solution?: Maybe<Scalars['String']>;
  three_d?: Maybe<Scalars['Boolean']>;
  user?: Maybe<PublicUserAccount>;
  user_id?: Maybe<Scalars['String']>;
};

export type CustomTrainerCreateInput = {
  alt_solutions?: InputMaybe<Scalars['String']>;
  colors?: InputMaybe<Scalars['String']>;
  cube_type: Scalars['String'];
  description?: InputMaybe<Scalars['String']>;
  group_name?: InputMaybe<Scalars['String']>;
  name: Scalars['String'];
  private?: InputMaybe<Scalars['Boolean']>;
  scrambles?: InputMaybe<Scalars['String']>;
  solution: Scalars['String'];
  three_d?: InputMaybe<Scalars['Boolean']>;
};

export type DailyGoalReminderResult = {
  __typename?: 'DailyGoalReminderResult';
  enabled?: Maybe<Scalars['Boolean']>;
};

export type DailyGoalType = {
  __typename?: 'DailyGoalType';
  cube_type?: Maybe<Scalars['String']>;
  enabled?: Maybe<Scalars['Boolean']>;
  id?: Maybe<Scalars['String']>;
  target?: Maybe<Scalars['Int']>;
};

export type DemoSolve = {
  __typename?: 'DemoSolve';
  created_at?: Maybe<Scalars['DateTime']>;
  cube_type?: Maybe<Scalars['String']>;
  demo_session_id?: Maybe<Scalars['String']>;
  ended_at?: Maybe<Scalars['BigInt']>;
  id?: Maybe<Scalars['String']>;
  ip_address?: Maybe<Scalars['String']>;
  raw_time?: Maybe<Scalars['Float']>;
  scramble?: Maybe<Scalars['String']>;
  started_at?: Maybe<Scalars['BigInt']>;
  updated_at?: Maybe<Scalars['DateTime']>;
};

export type DemoSolveInput = {
  cube_type?: InputMaybe<Scalars['String']>;
  demo_session_id?: InputMaybe<Scalars['String']>;
  ended_at?: InputMaybe<Scalars['BigInt']>;
  raw_time?: InputMaybe<Scalars['Float']>;
  scramble?: InputMaybe<Scalars['String']>;
  started_at?: InputMaybe<Scalars['BigInt']>;
};

export type File = {
  __typename?: 'File';
  encoding: Scalars['String'];
  filename: Scalars['String'];
  mimetype: Scalars['String'];
};

export type IInternalUserAccount = {
  admin?: Maybe<Scalars['Boolean']>;
  badges?: Maybe<Array<Maybe<Badge>>>;
  banned_forever?: Maybe<Scalars['Boolean']>;
  banned_until?: Maybe<Scalars['DateTime']>;
  bans?: Maybe<Array<Maybe<BanLog>>>;
  created_at?: Maybe<Scalars['DateTime']>;
  email?: Maybe<Scalars['String']>;
  email_verified?: Maybe<Scalars['Boolean']>;
  first_name?: Maybe<Scalars['String']>;
  has_password?: Maybe<Scalars['Boolean']>;
  id?: Maybe<Scalars['String']>;
  integrations?: Maybe<Array<Maybe<Integration>>>;
  is_premium?: Maybe<Scalars['Boolean']>;
  is_pro?: Maybe<Scalars['Boolean']>;
  join_country?: Maybe<Scalars['String']>;
  join_ip?: Maybe<Scalars['String']>;
  last_name?: Maybe<Scalars['String']>;
  last_solve_at?: Maybe<Scalars['DateTime']>;
  mod?: Maybe<Scalars['Boolean']>;
  notification_preferences?: Maybe<NotificationPreference>;
  offline_hash?: Maybe<Scalars['String']>;
  password?: Maybe<Scalars['String']>;
  premium_expires_at?: Maybe<Scalars['DateTime']>;
  pro_expires_at?: Maybe<Scalars['DateTime']>;
  profile?: Maybe<Profile>;
  pushTokens?: Maybe<Array<PushTokenInfo>>;
  reports_for?: Maybe<Array<Maybe<Report>>>;
  settings?: Maybe<Setting>;
  summary?: Maybe<UserAccountSummary>;
  timer_background?: Maybe<TimerBackground>;
  top_averages?: Maybe<Array<Maybe<TopAverage>>>;
  top_solves?: Maybe<Array<Maybe<TopSolve>>>;
  username?: Maybe<Scalars['String']>;
  verified?: Maybe<Scalars['Boolean']>;
};

export type Image = {
  __typename?: 'Image';
  created_at?: Maybe<Scalars['DateTime']>;
  id?: Maybe<Scalars['String']>;
  storage_path?: Maybe<Scalars['String']>;
  url?: Maybe<Scalars['String']>;
  user?: Maybe<PublicUserAccount>;
  user_id?: Maybe<Scalars['String']>;
};

export type Integration = {
  __typename?: 'Integration';
  auth_expires_at?: Maybe<Scalars['BigInt']>;
  auth_token?: Maybe<Scalars['String']>;
  created_at?: Maybe<Scalars['DateTime']>;
  id?: Maybe<Scalars['String']>;
  refresh_token?: Maybe<Scalars['String']>;
  service_name?: Maybe<IntegrationType>;
  user?: Maybe<PublicUserAccount>;
  user_id?: Maybe<Scalars['String']>;
  wca_competition_count?: Maybe<Scalars['Float']>;
  wca_country_iso2?: Maybe<Scalars['String']>;
  wca_id?: Maybe<Scalars['String']>;
  wca_medal_bronze?: Maybe<Scalars['Float']>;
  wca_medal_gold?: Maybe<Scalars['Float']>;
  wca_medal_silver?: Maybe<Scalars['Float']>;
  wca_record_cr?: Maybe<Scalars['Float']>;
  wca_record_nr?: Maybe<Scalars['Float']>;
  wca_record_wr?: Maybe<Scalars['Float']>;
  wca_show_competitions?: Maybe<Scalars['Boolean']>;
  wca_show_medals?: Maybe<Scalars['Boolean']>;
  wca_show_rank?: Maybe<Scalars['Boolean']>;
  wca_show_records?: Maybe<Scalars['Boolean']>;
  wca_show_results?: Maybe<Scalars['Boolean']>;
};

export enum IntegrationType {
  Wca = 'wca'
}

export type InternalUserAccount = IInternalUserAccount & IPublicUserAccount & IUserAccount & IUserAccountForAdmin & {
  __typename?: 'InternalUserAccount';
  admin?: Maybe<Scalars['Boolean']>;
  badges?: Maybe<Array<Maybe<Badge>>>;
  banned_forever?: Maybe<Scalars['Boolean']>;
  banned_until?: Maybe<Scalars['DateTime']>;
  bans?: Maybe<Array<Maybe<BanLog>>>;
  created_at?: Maybe<Scalars['DateTime']>;
  email?: Maybe<Scalars['String']>;
  email_verified?: Maybe<Scalars['Boolean']>;
  first_name?: Maybe<Scalars['String']>;
  has_password?: Maybe<Scalars['Boolean']>;
  id?: Maybe<Scalars['String']>;
  integrations?: Maybe<Array<Maybe<Integration>>>;
  is_premium?: Maybe<Scalars['Boolean']>;
  is_pro?: Maybe<Scalars['Boolean']>;
  join_country?: Maybe<Scalars['String']>;
  join_ip?: Maybe<Scalars['String']>;
  last_name?: Maybe<Scalars['String']>;
  last_solve_at?: Maybe<Scalars['DateTime']>;
  mod?: Maybe<Scalars['Boolean']>;
  notification_preferences?: Maybe<NotificationPreference>;
  offline_hash?: Maybe<Scalars['String']>;
  password?: Maybe<Scalars['String']>;
  premium_expires_at?: Maybe<Scalars['DateTime']>;
  pro_expires_at?: Maybe<Scalars['DateTime']>;
  profile?: Maybe<Profile>;
  pushTokens?: Maybe<Array<PushTokenInfo>>;
  reports_for?: Maybe<Array<Maybe<Report>>>;
  settings?: Maybe<Setting>;
  summary?: Maybe<UserAccountSummary>;
  timer_background?: Maybe<TimerBackground>;
  top_averages?: Maybe<Array<Maybe<TopAverage>>>;
  top_solves?: Maybe<Array<Maybe<TopSolve>>>;
  username?: Maybe<Scalars['String']>;
  verified?: Maybe<Scalars['Boolean']>;
};

export type IPublicUserAccount = {
  admin?: Maybe<Scalars['Boolean']>;
  badges?: Maybe<Array<Maybe<Badge>>>;
  banned_forever?: Maybe<Scalars['Boolean']>;
  banned_until?: Maybe<Scalars['DateTime']>;
  created_at?: Maybe<Scalars['DateTime']>;
  id?: Maybe<Scalars['String']>;
  integrations?: Maybe<Array<Maybe<Integration>>>;
  is_premium?: Maybe<Scalars['Boolean']>;
  is_pro?: Maybe<Scalars['Boolean']>;
  last_solve_at?: Maybe<Scalars['DateTime']>;
  mod?: Maybe<Scalars['Boolean']>;
  premium_expires_at?: Maybe<Scalars['DateTime']>;
  pro_expires_at?: Maybe<Scalars['DateTime']>;
  profile?: Maybe<Profile>;
  top_averages?: Maybe<Array<Maybe<TopAverage>>>;
  top_solves?: Maybe<Array<Maybe<TopSolve>>>;
  username?: Maybe<Scalars['String']>;
  verified?: Maybe<Scalars['Boolean']>;
};

export type IUserAccount = {
  admin?: Maybe<Scalars['Boolean']>;
  badges?: Maybe<Array<Maybe<Badge>>>;
  banned_forever?: Maybe<Scalars['Boolean']>;
  banned_until?: Maybe<Scalars['DateTime']>;
  bans?: Maybe<Array<Maybe<BanLog>>>;
  created_at?: Maybe<Scalars['DateTime']>;
  email?: Maybe<Scalars['String']>;
  first_name?: Maybe<Scalars['String']>;
  has_password?: Maybe<Scalars['Boolean']>;
  id?: Maybe<Scalars['String']>;
  integrations?: Maybe<Array<Maybe<Integration>>>;
  is_premium?: Maybe<Scalars['Boolean']>;
  is_pro?: Maybe<Scalars['Boolean']>;
  join_country?: Maybe<Scalars['String']>;
  last_name?: Maybe<Scalars['String']>;
  last_solve_at?: Maybe<Scalars['DateTime']>;
  mod?: Maybe<Scalars['Boolean']>;
  offline_hash?: Maybe<Scalars['String']>;
  premium_expires_at?: Maybe<Scalars['DateTime']>;
  pro_expires_at?: Maybe<Scalars['DateTime']>;
  profile?: Maybe<Profile>;
  timer_background?: Maybe<TimerBackground>;
  top_averages?: Maybe<Array<Maybe<TopAverage>>>;
  top_solves?: Maybe<Array<Maybe<TopSolve>>>;
  username?: Maybe<Scalars['String']>;
  verified?: Maybe<Scalars['Boolean']>;
};

export type IUserAccountForAdmin = {
  admin?: Maybe<Scalars['Boolean']>;
  badges?: Maybe<Array<Maybe<Badge>>>;
  banned_forever?: Maybe<Scalars['Boolean']>;
  banned_until?: Maybe<Scalars['DateTime']>;
  bans?: Maybe<Array<Maybe<BanLog>>>;
  created_at?: Maybe<Scalars['DateTime']>;
  email?: Maybe<Scalars['String']>;
  email_verified?: Maybe<Scalars['Boolean']>;
  first_name?: Maybe<Scalars['String']>;
  has_password?: Maybe<Scalars['Boolean']>;
  id?: Maybe<Scalars['String']>;
  integrations?: Maybe<Array<Maybe<Integration>>>;
  is_premium?: Maybe<Scalars['Boolean']>;
  is_pro?: Maybe<Scalars['Boolean']>;
  join_country?: Maybe<Scalars['String']>;
  join_ip?: Maybe<Scalars['String']>;
  last_name?: Maybe<Scalars['String']>;
  last_solve_at?: Maybe<Scalars['DateTime']>;
  mod?: Maybe<Scalars['Boolean']>;
  notification_preferences?: Maybe<NotificationPreference>;
  offline_hash?: Maybe<Scalars['String']>;
  premium_expires_at?: Maybe<Scalars['DateTime']>;
  pro_expires_at?: Maybe<Scalars['DateTime']>;
  profile?: Maybe<Profile>;
  pushTokens?: Maybe<Array<PushTokenInfo>>;
  reports_for?: Maybe<Array<Maybe<Report>>>;
  settings?: Maybe<Setting>;
  summary?: Maybe<UserAccountSummary>;
  timer_background?: Maybe<TimerBackground>;
  top_averages?: Maybe<Array<Maybe<TopAverage>>>;
  top_solves?: Maybe<Array<Maybe<TopSolve>>>;
  username?: Maybe<Scalars['String']>;
  verified?: Maybe<Scalars['Boolean']>;
};

export type Mutation = {
  __typename?: 'Mutation';
  addBadgeToUser?: Maybe<Badge>;
  addNewSmartDevice?: Maybe<SmartDevice>;
  adminDeleteTrainerAlternative?: Maybe<TrainerAlternative>;
  adminDeleteUserAccount?: Maybe<UserAccount>;
  adminSendPushToUser?: Maybe<AdminSendPushResult>;
  authenticateUser: PublicUserAccount;
  authenticateWithWca?: Maybe<WcaOAuthResult>;
  banUserAccount?: Maybe<BanLog>;
  bulkCreateSessions?: Maybe<Scalars['Void']>;
  bulkCreateSolves?: Maybe<Scalars['Void']>;
  changeSmartDeviceName?: Maybe<SmartDevice>;
  checkForgotPasswordCode?: Maybe<Scalars['Boolean']>;
  completeWcaSignup?: Maybe<PublicUserAccount>;
  createAnnouncement?: Maybe<Announcement>;
  createBadgeType?: Maybe<BadgeType>;
  createCustomCubeType?: Maybe<CustomCubeType>;
  createCustomTrainer?: Maybe<CustomTrainer>;
  createDemoSolve?: Maybe<DemoSolve>;
  createIntegration?: Maybe<Integration>;
  createPromoCode?: Maybe<PromoCode>;
  createSession?: Maybe<Session>;
  createSolve?: Maybe<Solve>;
  createTrainerAlternative?: Maybe<TrainerAlternative>;
  createUserAccount?: Maybe<PublicUserAccount>;
  deleteAlgorithmOverride?: Maybe<AlgorithmOverride>;
  deleteAllSolves?: Maybe<Scalars['Void']>;
  deleteAllSolvesInSession?: Maybe<Scalars['Void']>;
  deleteAllTrainingSolves?: Maybe<Scalars['Void']>;
  deleteAnnouncement?: Maybe<Scalars['Boolean']>;
  deleteBadgeType?: Maybe<BadgeType>;
  deleteCustomCubeType?: Maybe<CustomCubeType>;
  deleteCustomTrainer?: Maybe<CustomTrainer>;
  deleteIntegration?: Maybe<Integration>;
  deleteNotification?: Maybe<Notification>;
  deletePromoCode?: Maybe<Scalars['Boolean']>;
  deleteSession?: Maybe<Session>;
  deleteSmartDevice?: Maybe<SmartDevice>;
  deleteSolve: Solve;
  deleteSolves?: Maybe<Scalars['Boolean']>;
  deleteSolvesByCubeType?: Maybe<Scalars['Void']>;
  deleteTimerBackground: TimerBackground;
  deleteTopAverage?: Maybe<TopAverage>;
  deleteTopSolve?: Maybe<TopSolve>;
  deleteTrainingSolves?: Maybe<Scalars['Void']>;
  deleteUserAccount?: Maybe<PublicUserAccount>;
  editBadgeType?: Maybe<BadgeType>;
  fetchWcaRecords?: Maybe<Array<Maybe<WcaRecord>>>;
  logOut: PublicUserAccount;
  markAnnouncementAsViewed?: Maybe<Scalars['Boolean']>;
  markNotificationAsRead?: Maybe<Notification>;
  mergeSessions?: Maybe<Session>;
  publishTopAverages?: Maybe<TopAverage>;
  publishTopSolve?: Maybe<TopSolve>;
  publishWcaRecord?: Maybe<WcaRecord>;
  redeemPromoCode?: Maybe<RedeemPromoCodeResult>;
  registerPushToken?: Maybe<PushTokenResult>;
  removeBadgeFromUser?: Maybe<Badge>;
  removeDailyGoal?: Maybe<Scalars['Boolean']>;
  reorderSessions?: Maybe<Scalars['Void']>;
  reportProfile?: Maybe<Report>;
  resendEmailVerificationCode?: Maybe<Scalars['Void']>;
  resetSettings?: Maybe<Setting>;
  resolveReports?: Maybe<Scalars['Float']>;
  sendBulkEmail?: Maybe<BulkEmailResult>;
  sendForgotPasswordCode?: Maybe<Scalars['Void']>;
  setDailyGoal?: Maybe<DailyGoalType>;
  setDailyGoalReminder?: Maybe<DailyGoalReminderResult>;
  setPremiumStatus?: Maybe<UserAccount>;
  setProStatus?: Maybe<UserAccount>;
  setSetting?: Maybe<Setting>;
  setTimerBackgroundHex: TimerBackground;
  setUserPassword?: Maybe<PublicUserAccount>;
  setVerifiedStatus?: Maybe<UserAccount>;
  togglePromoCodeActive?: Maybe<PromoCode>;
  unbanUserAccount?: Maybe<UserAccount>;
  unpublishWcaRecord?: Maybe<WcaRecord>;
  unregisterPushToken?: Maybe<PushTokenResult>;
  unsubEmails?: Maybe<Scalars['Boolean']>;
  updateAlgorithmOverride?: Maybe<AlgorithmOverride>;
  updateAnnouncement?: Maybe<Announcement>;
  updateCustomTrainer?: Maybe<CustomTrainer>;
  updateForgotPassword?: Maybe<PublicUserAccount>;
  updateNotificationPreferences?: Maybe<NotificationPreference>;
  updateOfflineHash?: Maybe<Scalars['String']>;
  updateProfile: Profile;
  updateSession?: Maybe<Session>;
  updateSiteConfig?: Maybe<SiteConfig>;
  updateSolve: Solve;
  updateStatsModuleBlocks?: Maybe<StatsModule>;
  updateUserAccount?: Maybe<PublicUserAccount>;
  updateUserPassword?: Maybe<PublicUserAccount>;
  updateWcaVisibility?: Maybe<Integration>;
  uploadProfileHeader: Image;
  uploadProfilePicture: Image;
  uploadTimerBackground: TimerBackground;
  verifyEmailCode?: Maybe<PublicUserAccount>;
};


export type MutationAddBadgeToUserArgs = {
  badgeTypeId?: InputMaybe<Scalars['String']>;
  userId?: InputMaybe<Scalars['String']>;
};


export type MutationAddNewSmartDeviceArgs = {
  deviceId?: InputMaybe<Scalars['String']>;
  originalName?: InputMaybe<Scalars['String']>;
};


export type MutationAdminDeleteTrainerAlternativeArgs = {
  id?: InputMaybe<Scalars['String']>;
};


export type MutationAdminDeleteUserAccountArgs = {
  userId?: InputMaybe<Scalars['String']>;
};


export type MutationAdminSendPushToUserArgs = {
  body?: InputMaybe<Scalars['String']>;
  title?: InputMaybe<Scalars['String']>;
  userId?: InputMaybe<Scalars['String']>;
};


export type MutationAuthenticateUserArgs = {
  email: Scalars['String'];
  password: Scalars['String'];
  remember?: InputMaybe<Scalars['Boolean']>;
};


export type MutationAuthenticateWithWcaArgs = {
  code?: InputMaybe<Scalars['String']>;
};


export type MutationBanUserAccountArgs = {
  input?: InputMaybe<BanUserInput>;
};


export type MutationBulkCreateSessionsArgs = {
  sessions?: InputMaybe<Array<InputMaybe<SessionInput>>>;
};


export type MutationBulkCreateSolvesArgs = {
  solves?: InputMaybe<Array<InputMaybe<SolveInput>>>;
};


export type MutationChangeSmartDeviceNameArgs = {
  id?: InputMaybe<Scalars['String']>;
  name?: InputMaybe<Scalars['String']>;
};


export type MutationCheckForgotPasswordCodeArgs = {
  code?: InputMaybe<Scalars['String']>;
  email?: InputMaybe<Scalars['String']>;
};


export type MutationCompleteWcaSignupArgs = {
  username?: InputMaybe<Scalars['String']>;
};


export type MutationCreateAnnouncementArgs = {
  input?: InputMaybe<CreateAnnouncementInput>;
};


export type MutationCreateBadgeTypeArgs = {
  input?: InputMaybe<BadgeTypeInput>;
};


export type MutationCreateCustomCubeTypeArgs = {
  input?: InputMaybe<CustomCubeTypeInput>;
};


export type MutationCreateCustomTrainerArgs = {
  input?: InputMaybe<CustomTrainerCreateInput>;
};


export type MutationCreateDemoSolveArgs = {
  input?: InputMaybe<DemoSolveInput>;
};


export type MutationCreateIntegrationArgs = {
  code?: InputMaybe<Scalars['String']>;
  integrationType?: InputMaybe<IntegrationType>;
};


export type MutationCreatePromoCodeArgs = {
  input?: InputMaybe<CreatePromoCodeInput>;
};


export type MutationCreateSessionArgs = {
  input?: InputMaybe<SessionInput>;
};


export type MutationCreateSolveArgs = {
  input?: InputMaybe<SolveInput>;
};


export type MutationCreateTrainerAlternativeArgs = {
  input?: InputMaybe<TrainerAlternativeCreateInput>;
};


export type MutationCreateUserAccountArgs = {
  email: Scalars['String'];
  first_name: Scalars['String'];
  language?: InputMaybe<Scalars['String']>;
  last_name: Scalars['String'];
  password: Scalars['String'];
  username: Scalars['String'];
};


export type MutationDeleteAlgorithmOverrideArgs = {
  algoKey?: InputMaybe<Scalars['String']>;
};


export type MutationDeleteAllSolvesInSessionArgs = {
  sessionId?: InputMaybe<Scalars['String']>;
};


export type MutationDeleteAnnouncementArgs = {
  id?: InputMaybe<Scalars['String']>;
};


export type MutationDeleteBadgeTypeArgs = {
  id: Scalars['String'];
};


export type MutationDeleteCustomCubeTypeArgs = {
  id?: InputMaybe<Scalars['String']>;
};


export type MutationDeleteCustomTrainerArgs = {
  id?: InputMaybe<Scalars['String']>;
};


export type MutationDeleteIntegrationArgs = {
  integrationType?: InputMaybe<IntegrationType>;
};


export type MutationDeleteNotificationArgs = {
  id?: InputMaybe<Scalars['String']>;
};


export type MutationDeletePromoCodeArgs = {
  id?: InputMaybe<Scalars['String']>;
};


export type MutationDeleteSessionArgs = {
  id?: InputMaybe<Scalars['String']>;
};


export type MutationDeleteSmartDeviceArgs = {
  id?: InputMaybe<Scalars['String']>;
};


export type MutationDeleteSolveArgs = {
  id?: InputMaybe<Scalars['String']>;
};


export type MutationDeleteSolvesArgs = {
  ids?: InputMaybe<Array<InputMaybe<Scalars['String']>>>;
};


export type MutationDeleteSolvesByCubeTypeArgs = {
  cubeType?: InputMaybe<Scalars['String']>;
};


export type MutationDeleteTopAverageArgs = {
  id?: InputMaybe<Scalars['String']>;
};


export type MutationDeleteTopSolveArgs = {
  id?: InputMaybe<Scalars['String']>;
};


export type MutationDeleteTrainingSolvesArgs = {
  id?: InputMaybe<Scalars['String']>;
};


export type MutationEditBadgeTypeArgs = {
  id?: InputMaybe<Scalars['String']>;
  input?: InputMaybe<BadgeTypeInput>;
};


export type MutationMarkAnnouncementAsViewedArgs = {
  announcementId?: InputMaybe<Scalars['String']>;
};


export type MutationMarkNotificationAsReadArgs = {
  id?: InputMaybe<Scalars['String']>;
};


export type MutationMergeSessionsArgs = {
  newSessionId?: InputMaybe<Scalars['String']>;
  oldSessionId?: InputMaybe<Scalars['String']>;
};


export type MutationPublishTopAveragesArgs = {
  solveIds?: InputMaybe<Array<InputMaybe<Scalars['String']>>>;
};


export type MutationPublishTopSolveArgs = {
  solveId?: InputMaybe<Scalars['String']>;
};


export type MutationPublishWcaRecordArgs = {
  recordId?: InputMaybe<Scalars['String']>;
};


export type MutationRedeemPromoCodeArgs = {
  code?: InputMaybe<Scalars['String']>;
};


export type MutationRegisterPushTokenArgs = {
  input?: InputMaybe<RegisterPushTokenInput>;
};


export type MutationRemoveBadgeFromUserArgs = {
  badgeTypeId?: InputMaybe<Scalars['String']>;
  userId?: InputMaybe<Scalars['String']>;
};


export type MutationRemoveDailyGoalArgs = {
  cubeType?: InputMaybe<Scalars['String']>;
};


export type MutationReorderSessionsArgs = {
  ids?: InputMaybe<Array<InputMaybe<Scalars['String']>>>;
};


export type MutationReportProfileArgs = {
  reason?: InputMaybe<Scalars['String']>;
  userId?: InputMaybe<Scalars['String']>;
};


export type MutationResendEmailVerificationCodeArgs = {
  email: Scalars['String'];
  language?: InputMaybe<Scalars['String']>;
};


export type MutationResolveReportsArgs = {
  userId?: InputMaybe<Scalars['String']>;
};


export type MutationSendBulkEmailArgs = {
  input?: InputMaybe<SendBulkEmailInput>;
};


export type MutationSendForgotPasswordCodeArgs = {
  email?: InputMaybe<Scalars['String']>;
  language?: InputMaybe<Scalars['String']>;
};


export type MutationSetDailyGoalArgs = {
  input?: InputMaybe<SetDailyGoalInput>;
};


export type MutationSetDailyGoalReminderArgs = {
  enabled?: InputMaybe<Scalars['Boolean']>;
};


export type MutationSetPremiumStatusArgs = {
  isPremium?: InputMaybe<Scalars['Boolean']>;
  minutes?: InputMaybe<Scalars['Float']>;
  userId?: InputMaybe<Scalars['String']>;
};


export type MutationSetProStatusArgs = {
  isPro?: InputMaybe<Scalars['Boolean']>;
  minutes?: InputMaybe<Scalars['Float']>;
  userId?: InputMaybe<Scalars['String']>;
};


export type MutationSetSettingArgs = {
  input?: InputMaybe<SettingInput>;
};


export type MutationSetTimerBackgroundHexArgs = {
  hex?: InputMaybe<Scalars['String']>;
};


export type MutationSetUserPasswordArgs = {
  new_password: Scalars['String'];
};


export type MutationSetVerifiedStatusArgs = {
  userId?: InputMaybe<Scalars['String']>;
  verified?: InputMaybe<Scalars['Boolean']>;
};


export type MutationTogglePromoCodeActiveArgs = {
  id?: InputMaybe<Scalars['String']>;
  isActive?: InputMaybe<Scalars['Boolean']>;
};


export type MutationUnbanUserAccountArgs = {
  userId?: InputMaybe<Scalars['String']>;
};


export type MutationUnpublishWcaRecordArgs = {
  recordId?: InputMaybe<Scalars['String']>;
};


export type MutationUnregisterPushTokenArgs = {
  token?: InputMaybe<Scalars['String']>;
};


export type MutationUnsubEmailsArgs = {
  unsubId?: InputMaybe<Scalars['String']>;
};


export type MutationUpdateAlgorithmOverrideArgs = {
  algoKey?: InputMaybe<Scalars['String']>;
  input?: InputMaybe<AlgorithmOverrideInput>;
};


export type MutationUpdateAnnouncementArgs = {
  id?: InputMaybe<Scalars['String']>;
  input?: InputMaybe<UpdateAnnouncementInput>;
};


export type MutationUpdateCustomTrainerArgs = {
  id?: InputMaybe<Scalars['String']>;
  input?: InputMaybe<CustomTrainerCreateInput>;
};


export type MutationUpdateForgotPasswordArgs = {
  code?: InputMaybe<Scalars['String']>;
  email?: InputMaybe<Scalars['String']>;
  password?: InputMaybe<Scalars['String']>;
};


export type MutationUpdateNotificationPreferencesArgs = {
  key?: InputMaybe<Scalars['String']>;
  value?: InputMaybe<Scalars['Boolean']>;
};


export type MutationUpdateOfflineHashArgs = {
  hash?: InputMaybe<Scalars['String']>;
};


export type MutationUpdateProfileArgs = {
  input?: InputMaybe<ProfileInput>;
};


export type MutationUpdateSessionArgs = {
  id?: InputMaybe<Scalars['String']>;
  input?: InputMaybe<SessionInput>;
};


export type MutationUpdateSiteConfigArgs = {
  input?: InputMaybe<UpdateSiteConfigInput>;
};


export type MutationUpdateSolveArgs = {
  id?: InputMaybe<Scalars['String']>;
  input?: InputMaybe<SolveInput>;
};


export type MutationUpdateStatsModuleBlocksArgs = {
  blocks?: InputMaybe<Array<InputMaybe<StatsModuleBlockInput>>>;
};


export type MutationUpdateUserAccountArgs = {
  email: Scalars['String'];
  first_name: Scalars['String'];
  last_name: Scalars['String'];
  username: Scalars['String'];
};


export type MutationUpdateUserPasswordArgs = {
  new_password: Scalars['String'];
  old_password: Scalars['String'];
};


export type MutationUpdateWcaVisibilityArgs = {
  showCompetitions?: InputMaybe<Scalars['Boolean']>;
  showMedals?: InputMaybe<Scalars['Boolean']>;
  showRank?: InputMaybe<Scalars['Boolean']>;
  showRecords?: InputMaybe<Scalars['Boolean']>;
  showResults?: InputMaybe<Scalars['Boolean']>;
};


export type MutationUploadProfileHeaderArgs = {
  file?: InputMaybe<Scalars['Upload']>;
};


export type MutationUploadProfilePictureArgs = {
  file?: InputMaybe<Scalars['Upload']>;
};


export type MutationUploadTimerBackgroundArgs = {
  file?: InputMaybe<Scalars['Upload']>;
};


export type MutationVerifyEmailCodeArgs = {
  code: Scalars['String'];
  email: Scalars['String'];
  language?: InputMaybe<Scalars['String']>;
};

export type Notification = {
  __typename?: 'Notification';
  created_at?: Maybe<Scalars['DateTime']>;
  icon?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  in_app_message?: Maybe<Scalars['String']>;
  link?: Maybe<Scalars['String']>;
  link_text?: Maybe<Scalars['String']>;
  message?: Maybe<Scalars['String']>;
  notification_category_name?: Maybe<Scalars['String']>;
  notification_type?: Maybe<Scalars['String']>;
  read_at?: Maybe<Scalars['DateTime']>;
  subject?: Maybe<Scalars['String']>;
  triggering_user?: Maybe<PublicUserAccount>;
  triggering_user_id?: Maybe<Scalars['String']>;
  user_id?: Maybe<Scalars['String']>;
};

export type NotificationPreference = {
  __typename?: 'NotificationPreference';
  created_at?: Maybe<Scalars['DateTime']>;
  id?: Maybe<Scalars['String']>;
  marketing_emails?: Maybe<Scalars['Boolean']>;
  user_id?: Maybe<Scalars['String']>;
};

export type PaginatedCustomTrainers = {
  __typename?: 'PaginatedCustomTrainers';
  hasMore?: Maybe<Scalars['Boolean']>;
  items?: Maybe<Array<Maybe<CustomTrainer>>>;
  total?: Maybe<Scalars['Int']>;
};

export type PaginatedTrainerAlternatives = {
  __typename?: 'PaginatedTrainerAlternatives';
  hasMore?: Maybe<Scalars['Boolean']>;
  items?: Maybe<Array<Maybe<TrainerAlternative>>>;
  total?: Maybe<Scalars['Int']>;
};

export type PaginatedUserAccounts = {
  __typename?: 'PaginatedUserAccounts';
  hasMore?: Maybe<Scalars['Boolean']>;
  items?: Maybe<Array<Maybe<PublicUserAccount>>>;
  total?: Maybe<Scalars['Int']>;
};

export type PaginatedUserAccountsForAdmin = {
  __typename?: 'PaginatedUserAccountsForAdmin';
  hasMore?: Maybe<Scalars['Boolean']>;
  items?: Maybe<Array<Maybe<UserAccountForAdmin>>>;
  total?: Maybe<Scalars['Int']>;
};

export type PaginationArgsInput = {
  page?: InputMaybe<Scalars['Int']>;
  pageSize?: InputMaybe<Scalars['Int']>;
  searchQuery?: InputMaybe<Scalars['String']>;
};

export type Profile = {
  __typename?: 'Profile';
  bio?: Maybe<Scalars['String']>;
  created_at?: Maybe<Scalars['DateTime']>;
  favorite_event?: Maybe<Scalars['String']>;
  header_image?: Maybe<Image>;
  header_image_id?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  main_three_cube?: Maybe<Scalars['String']>;
  pfp_image?: Maybe<Image>;
  pfp_image_id?: Maybe<Scalars['String']>;
  reddit_link?: Maybe<Scalars['String']>;
  three_goal?: Maybe<Scalars['String']>;
  three_method?: Maybe<Scalars['String']>;
  top_averages?: Maybe<Array<Maybe<TopAverage>>>;
  top_solves?: Maybe<Array<Maybe<TopSolve>>>;
  twitch_link?: Maybe<Scalars['String']>;
  twitter_link?: Maybe<Scalars['String']>;
  user?: Maybe<PublicUserAccount>;
  user_id?: Maybe<Scalars['String']>;
  youtube_link?: Maybe<Scalars['String']>;
};

export type ProfileInput = {
  bio?: InputMaybe<Scalars['String']>;
  favorite_event?: InputMaybe<Scalars['String']>;
  main_three_cube?: InputMaybe<Scalars['String']>;
  reddit_link?: InputMaybe<Scalars['String']>;
  three_goal?: InputMaybe<Scalars['String']>;
  three_method?: InputMaybe<Scalars['String']>;
  twitch_link?: InputMaybe<Scalars['String']>;
  twitter_link?: InputMaybe<Scalars['String']>;
  youtube_link?: InputMaybe<Scalars['String']>;
};

export type PromoCode = {
  __typename?: 'PromoCode';
  code?: Maybe<Scalars['String']>;
  created_at?: Maybe<Scalars['DateTime']>;
  created_by_id?: Maybe<Scalars['String']>;
  current_uses?: Maybe<Scalars['Int']>;
  duration_minutes?: Maybe<Scalars['Int']>;
  expires_at?: Maybe<Scalars['DateTime']>;
  id?: Maybe<Scalars['String']>;
  is_active?: Maybe<Scalars['Boolean']>;
  max_uses?: Maybe<Scalars['Int']>;
  membership_type?: Maybe<Scalars['String']>;
};

export type PromoCodeRedemptionInfo = {
  __typename?: 'PromoCodeRedemptionInfo';
  id?: Maybe<Scalars['String']>;
  redeemed_at?: Maybe<Scalars['DateTime']>;
  username?: Maybe<Scalars['String']>;
};

export type PublicUserAccount = IPublicUserAccount & {
  __typename?: 'PublicUserAccount';
  admin?: Maybe<Scalars['Boolean']>;
  badges?: Maybe<Array<Maybe<Badge>>>;
  banned_forever?: Maybe<Scalars['Boolean']>;
  banned_until?: Maybe<Scalars['DateTime']>;
  created_at?: Maybe<Scalars['DateTime']>;
  id?: Maybe<Scalars['String']>;
  integrations?: Maybe<Array<Maybe<Integration>>>;
  is_premium?: Maybe<Scalars['Boolean']>;
  is_pro?: Maybe<Scalars['Boolean']>;
  last_solve_at?: Maybe<Scalars['DateTime']>;
  mod?: Maybe<Scalars['Boolean']>;
  premium_expires_at?: Maybe<Scalars['DateTime']>;
  pro_expires_at?: Maybe<Scalars['DateTime']>;
  profile?: Maybe<Profile>;
  top_averages?: Maybe<Array<Maybe<TopAverage>>>;
  top_solves?: Maybe<Array<Maybe<TopSolve>>>;
  username?: Maybe<Scalars['String']>;
  verified?: Maybe<Scalars['Boolean']>;
};

export type PushTokenInfo = {
  __typename?: 'PushTokenInfo';
  platform?: Maybe<Scalars['String']>;
};

export type PushTokenResult = {
  __typename?: 'PushTokenResult';
  success?: Maybe<Scalars['Boolean']>;
};

export type Query = {
  __typename?: 'Query';
  adminTrainerAlternatives?: Maybe<PaginatedTrainerAlternatives>;
  adminUserSearch?: Maybe<PaginatedUserAccountsForAdmin>;
  algorithmOverrides?: Maybe<Array<Maybe<AlgorithmOverride>>>;
  badgeTypes?: Maybe<Array<Maybe<BadgeType>>>;
  customCubeTypes?: Maybe<Array<Maybe<CustomCubeType>>>;
  customTrainer?: Maybe<CustomTrainer>;
  customTrainers?: Maybe<Array<Maybe<CustomTrainer>>>;
  dailyGoalReminderStatus?: Maybe<DailyGoalReminderResult>;
  dailyGoals?: Maybe<Array<Maybe<DailyGoalType>>>;
  getActiveAnnouncements?: Maybe<Array<Maybe<Announcement>>>;
  getAllAnnouncements?: Maybe<Array<Maybe<Announcement>>>;
  getMyAnnouncementHistory?: Maybe<Array<Maybe<Announcement>>>;
  getPromoCodeRedemptions?: Maybe<Array<Maybe<PromoCodeRedemptionInfo>>>;
  getPromoCodes?: Maybe<Array<Maybe<PromoCode>>>;
  getUnreadAnnouncementCount?: Maybe<UnreadAnnouncementCount>;
  getUserAccountForAdmin?: Maybe<UserAccountForAdmin>;
  integration?: Maybe<Integration>;
  integrations?: Maybe<Array<Maybe<Integration>>>;
  me: UserAccount;
  myWcaCompetitions?: Maybe<Array<Maybe<WcaCompetition>>>;
  myWcaRecords?: Maybe<Array<Maybe<WcaRecord>>>;
  notificationPreferences?: Maybe<NotificationPreference>;
  notifications?: Maybe<Array<Maybe<Notification>>>;
  profile: Profile;
  reports?: Maybe<Array<Maybe<ReportSummary>>>;
  sessions?: Maybe<Array<Maybe<Session>>>;
  settings?: Maybe<Setting>;
  siteConfig?: Maybe<SiteConfig>;
  smartDevices?: Maybe<Array<Maybe<SmartDevice>>>;
  solve?: Maybe<Solve>;
  solveByShareCode?: Maybe<Solve>;
  solveList?: Maybe<SolveList>;
  solves?: Maybe<Array<Maybe<Solve>>>;
  solvesByIds?: Maybe<Array<Maybe<Solve>>>;
  stats?: Maybe<Stats>;
  statsModule?: Maybe<StatsModule>;
  topAverages?: Maybe<Array<Maybe<TopAverage>>>;
  topSolves?: Maybe<Array<Maybe<TopSolve>>>;
  trainerAlternatives?: Maybe<Array<Maybe<TrainerAlternative>>>;
  unreadNotificationCount?: Maybe<Scalars['Int']>;
  userSearch?: Maybe<PaginatedUserAccounts>;
  wcaCompetitionDetail?: Maybe<WcaCompetitionDetail>;
  wcaCompetitions?: Maybe<Array<Maybe<WcaCompetition>>>;
  wcaLiveCompetitionOverview?: Maybe<WcaLiveCompetitionOverview>;
  wcaLiveCompetitorResults?: Maybe<WcaLiveCompetitorResults>;
  wcaLiveRoundResults?: Maybe<WcaLiveRoundResults>;
  wcaMe?: Maybe<WcaAccount>;
  wcaRecords?: Maybe<Array<Maybe<WcaRecord>>>;
  wcaResults?: Maybe<Array<Maybe<WcaResult>>>;
  wcaSearchCompetitions?: Maybe<Array<Maybe<WcaCompetition>>>;
  youtubeSearch?: Maybe<Array<Maybe<YouTubeVideoResult>>>;
};


export type QueryAdminTrainerAlternativesArgs = {
  category?: InputMaybe<Scalars['String']>;
  page?: InputMaybe<Scalars['Int']>;
  pageSize?: InputMaybe<Scalars['Int']>;
};


export type QueryAdminUserSearchArgs = {
  filters?: InputMaybe<AdminUserFiltersInput>;
  pageArgs?: InputMaybe<PaginationArgsInput>;
};


export type QueryCustomTrainerArgs = {
  id?: InputMaybe<Scalars['String']>;
};


export type QueryCustomTrainersArgs = {
  pageArgs?: InputMaybe<PaginationArgsInput>;
};


export type QueryGetAllAnnouncementsArgs = {
  filter?: InputMaybe<AnnouncementFilterInput>;
};


export type QueryGetMyAnnouncementHistoryArgs = {
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
};


export type QueryGetPromoCodeRedemptionsArgs = {
  promoCodeId?: InputMaybe<Scalars['String']>;
};


export type QueryGetUserAccountForAdminArgs = {
  userId?: InputMaybe<Scalars['String']>;
};


export type QueryIntegrationArgs = {
  integrationType?: InputMaybe<IntegrationType>;
};


export type QueryNotificationsArgs = {
  page?: InputMaybe<Scalars['Int']>;
};


export type QueryProfileArgs = {
  username?: InputMaybe<Scalars['String']>;
};


export type QuerySolveArgs = {
  id?: InputMaybe<Scalars['String']>;
};


export type QuerySolveByShareCodeArgs = {
  shareCode?: InputMaybe<Scalars['String']>;
};


export type QuerySolveListArgs = {
  cubeType?: InputMaybe<Scalars['String']>;
  filters?: InputMaybe<Array<InputMaybe<SolvesFilter>>>;
  includeAll?: InputMaybe<Scalars['Boolean']>;
  page?: InputMaybe<Scalars['Int']>;
  sortBy?: InputMaybe<SolvesSortBy>;
};


export type QuerySolvesArgs = {
  skip?: InputMaybe<Scalars['Int']>;
  take?: InputMaybe<Scalars['Int']>;
};


export type QuerySolvesByIdsArgs = {
  ids?: InputMaybe<Array<InputMaybe<Scalars['String']>>>;
};


export type QueryTopAveragesArgs = {
  cubeType?: InputMaybe<Scalars['String']>;
  page?: InputMaybe<Scalars['Int']>;
};


export type QueryTopSolvesArgs = {
  cubeType?: InputMaybe<Scalars['String']>;
  page?: InputMaybe<Scalars['Int']>;
};


export type QueryTrainerAlternativesArgs = {
  caseName?: InputMaybe<Scalars['String']>;
  category?: InputMaybe<Scalars['String']>;
};


export type QueryUserSearchArgs = {
  pageArgs?: InputMaybe<PaginationArgsInput>;
};


export type QueryWcaCompetitionDetailArgs = {
  input?: InputMaybe<WcaScheduleInput>;
};


export type QueryWcaCompetitionsArgs = {
  filter?: InputMaybe<WcaCompetitionFilterInput>;
};


export type QueryWcaLiveCompetitionOverviewArgs = {
  input?: InputMaybe<WcaLiveOverviewInput>;
};


export type QueryWcaLiveCompetitorResultsArgs = {
  input?: InputMaybe<WcaLiveCompetitorInput>;
};


export type QueryWcaLiveRoundResultsArgs = {
  input?: InputMaybe<WcaLiveRoundInput>;
};


export type QueryWcaRecordsArgs = {
  userId?: InputMaybe<Scalars['String']>;
};


export type QueryWcaResultsArgs = {
  wcaId?: InputMaybe<Scalars['String']>;
};


export type QueryWcaSearchCompetitionsArgs = {
  query?: InputMaybe<Scalars['String']>;
};


export type QueryYoutubeSearchArgs = {
  input?: InputMaybe<YouTubeSearchInput>;
};

export type RedeemPromoCodeResult = {
  __typename?: 'RedeemPromoCodeResult';
  expires_at?: Maybe<Scalars['DateTime']>;
  membership_type?: Maybe<Scalars['String']>;
  success?: Maybe<Scalars['Boolean']>;
};

export type RegisterPushTokenInput = {
  platform?: InputMaybe<Scalars['String']>;
  token?: InputMaybe<Scalars['String']>;
};

export type Report = {
  __typename?: 'Report';
  created_at?: Maybe<Scalars['DateTime']>;
  created_by?: Maybe<PublicUserAccount>;
  created_by_id?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  reason?: Maybe<Scalars['String']>;
  reported_user?: Maybe<PublicUserAccount>;
  reported_user_id?: Maybe<Scalars['String']>;
  resolved_at?: Maybe<Scalars['DateTime']>;
};

export type ReportSummary = {
  __typename?: 'ReportSummary';
  count?: Maybe<Scalars['Int']>;
  first_report?: Maybe<Scalars['DateTime']>;
  last_report?: Maybe<Scalars['DateTime']>;
  reports?: Maybe<Array<Maybe<Report>>>;
  user?: Maybe<PublicUserAccount>;
};

export type SendBulkEmailInput = {
  content?: InputMaybe<Scalars['String']>;
  sendToAll?: InputMaybe<Scalars['Boolean']>;
  subject?: InputMaybe<Scalars['String']>;
  userIds?: InputMaybe<Array<InputMaybe<Scalars['String']>>>;
};

export type Session = {
  __typename?: 'Session';
  created_at?: Maybe<Scalars['DateTime']>;
  demo_mode?: Maybe<Scalars['Boolean']>;
  id?: Maybe<Scalars['String']>;
  name?: Maybe<Scalars['String']>;
  order?: Maybe<Scalars['Float']>;
  user_id?: Maybe<Scalars['String']>;
};

export type SessionInput = {
  id?: InputMaybe<Scalars['String']>;
  name?: InputMaybe<Scalars['String']>;
  order?: InputMaybe<Scalars['Float']>;
};

export type SetDailyGoalInput = {
  cube_type?: InputMaybe<Scalars['String']>;
  enabled?: InputMaybe<Scalars['Boolean']>;
  target?: InputMaybe<Scalars['Int']>;
};

export type Setting = {
  __typename?: 'Setting';
  confirm_delete_season?: Maybe<Scalars['Boolean']>;
  confirm_delete_solve?: Maybe<Scalars['Boolean']>;
  created_at?: Maybe<Scalars['DateTime']>;
  cube_type?: Maybe<Scalars['String']>;
  custom_cube_types?: Maybe<Array<Maybe<CustomCubeType>>>;
  focus_mode?: Maybe<Scalars['Boolean']>;
  freeze_time?: Maybe<Scalars['Float']>;
  hide_time_when_solving?: Maybe<Scalars['Boolean']>;
  id?: Maybe<Scalars['String']>;
  inspection?: Maybe<Scalars['Boolean']>;
  inspection_delay?: Maybe<Scalars['Int']>;
  inverse_time_list?: Maybe<Scalars['Boolean']>;
  manual_entry?: Maybe<Scalars['Boolean']>;
  nav_collapsed?: Maybe<Scalars['Boolean']>;
  pb_confetti?: Maybe<Scalars['Boolean']>;
  play_inspection_sound?: Maybe<Scalars['Boolean']>;
  require_period_in_manual_time_entry?: Maybe<Scalars['Boolean']>;
  session_id?: Maybe<Scalars['String']>;
  smart_cube_size?: Maybe<Scalars['Int']>;
  timer_decimal_points?: Maybe<Scalars['Int']>;
  use_2d_scramble_visual?: Maybe<Scalars['Boolean']>;
  use_space_with_smart_cube?: Maybe<Scalars['Boolean']>;
  user_id?: Maybe<Scalars['String']>;
  zero_out_time_after_solve?: Maybe<Scalars['Boolean']>;
};

export type SettingInput = {
  confirm_delete_season?: InputMaybe<Scalars['Boolean']>;
  confirm_delete_solve?: InputMaybe<Scalars['Boolean']>;
  cube_type?: InputMaybe<Scalars['String']>;
  focus_mode?: InputMaybe<Scalars['Boolean']>;
  freeze_time?: InputMaybe<Scalars['Float']>;
  hide_time_when_solving?: InputMaybe<Scalars['Boolean']>;
  inspection?: InputMaybe<Scalars['Boolean']>;
  inspection_delay?: InputMaybe<Scalars['Int']>;
  inverse_time_list?: InputMaybe<Scalars['Boolean']>;
  manual_entry?: InputMaybe<Scalars['Boolean']>;
  nav_collapsed?: InputMaybe<Scalars['Boolean']>;
  pb_confetti?: InputMaybe<Scalars['Boolean']>;
  play_inspection_sound?: InputMaybe<Scalars['Boolean']>;
  require_period_in_manual_time_entry?: InputMaybe<Scalars['Boolean']>;
  session_id?: InputMaybe<Scalars['String']>;
  smart_cube_size?: InputMaybe<Scalars['Int']>;
  timer_decimal_points?: InputMaybe<Scalars['Int']>;
  use_2d_scramble_visual?: InputMaybe<Scalars['Boolean']>;
  use_space_with_smart_cube?: InputMaybe<Scalars['Boolean']>;
  zero_out_time_after_solve?: InputMaybe<Scalars['Boolean']>;
};

export type SiteConfig = {
  __typename?: 'SiteConfig';
  battle_enabled?: Maybe<Scalars['Boolean']>;
  community_enabled?: Maybe<Scalars['Boolean']>;
  id?: Maybe<Scalars['String']>;
  leaderboards_enabled?: Maybe<Scalars['Boolean']>;
  maintenance_mode?: Maybe<Scalars['Boolean']>;
  rooms_enabled?: Maybe<Scalars['Boolean']>;
  trainer_enabled?: Maybe<Scalars['Boolean']>;
  updated_at?: Maybe<Scalars['DateTime']>;
};

export type SmartDevice = {
  __typename?: 'SmartDevice';
  created_at?: Maybe<Scalars['DateTime']>;
  device_id?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  internal_name?: Maybe<Scalars['String']>;
  name?: Maybe<Scalars['String']>;
  solves?: Maybe<Array<Maybe<Solve>>>;
  user?: Maybe<PublicUserAccount>;
  user_id?: Maybe<Scalars['String']>;
};

export type SmartDeviceInput = {
  device_id?: InputMaybe<Scalars['String']>;
};

export type Solve = {
  __typename?: 'Solve';
  bulk?: Maybe<Scalars['Boolean']>;
  created_at?: Maybe<Scalars['DateTime']>;
  cube_type?: Maybe<Scalars['String']>;
  demo_mode?: Maybe<Scalars['Boolean']>;
  dnf?: Maybe<Scalars['Boolean']>;
  ended_at?: Maybe<Scalars['BigInt']>;
  from_timer?: Maybe<Scalars['Boolean']>;
  id?: Maybe<Scalars['String']>;
  inspection_time?: Maybe<Scalars['Float']>;
  is_smart_cube?: Maybe<Scalars['Boolean']>;
  notes?: Maybe<Scalars['String']>;
  plus_two?: Maybe<Scalars['Boolean']>;
  raw_time?: Maybe<Scalars['Float']>;
  scramble?: Maybe<Scalars['String']>;
  session_id?: Maybe<Scalars['String']>;
  share_code?: Maybe<Scalars['String']>;
  smart_device?: Maybe<SmartDevice>;
  smart_device_id?: Maybe<Scalars['String']>;
  smart_pick_up_time?: Maybe<Scalars['Float']>;
  smart_put_down_time?: Maybe<Scalars['Float']>;
  smart_turn_count?: Maybe<Scalars['Int']>;
  smart_turns?: Maybe<Scalars['String']>;
  solve_method_steps?: Maybe<Array<Maybe<SolveMethodStep>>>;
  solve_views?: Maybe<Array<Maybe<SolveView>>>;
  started_at?: Maybe<Scalars['BigInt']>;
  time?: Maybe<Scalars['Float']>;
  trainer_name?: Maybe<Scalars['String']>;
  training_session_id?: Maybe<Scalars['String']>;
  user?: Maybe<PublicUserAccount>;
  user_id?: Maybe<Scalars['String']>;
};

export type SolveInput = {
  bulk?: InputMaybe<Scalars['Boolean']>;
  cube_type?: InputMaybe<Scalars['String']>;
  dnf?: InputMaybe<Scalars['Boolean']>;
  ended_at?: InputMaybe<Scalars['BigInt']>;
  from_timer?: InputMaybe<Scalars['Boolean']>;
  id?: InputMaybe<Scalars['String']>;
  inspection_time?: InputMaybe<Scalars['Float']>;
  is_smart_cube?: InputMaybe<Scalars['Boolean']>;
  notes?: InputMaybe<Scalars['String']>;
  plus_two?: InputMaybe<Scalars['Boolean']>;
  raw_time?: InputMaybe<Scalars['Float']>;
  scramble?: InputMaybe<Scalars['String']>;
  session_id?: InputMaybe<Scalars['String']>;
  smart_device_id?: InputMaybe<Scalars['String']>;
  smart_pick_up_time?: InputMaybe<Scalars['Float']>;
  smart_put_down_time?: InputMaybe<Scalars['Float']>;
  smart_turn_count?: InputMaybe<Scalars['Int']>;
  smart_turns?: InputMaybe<Scalars['String']>;
  started_at?: InputMaybe<Scalars['BigInt']>;
  time?: InputMaybe<Scalars['Float']>;
  trainer_name?: InputMaybe<Scalars['String']>;
  training_session_id?: InputMaybe<Scalars['String']>;
};

export type SolveList = {
  __typename?: 'SolveList';
  more_results?: Maybe<Scalars['Boolean']>;
  solves?: Maybe<Array<Maybe<Solve>>>;
  total_count?: Maybe<Scalars['Int']>;
};

export type SolveMethodStep = {
  __typename?: 'SolveMethodStep';
  created_at?: Maybe<Scalars['DateTime']>;
  id?: Maybe<Scalars['String']>;
  method_name?: Maybe<Scalars['String']>;
  oll_case_key?: Maybe<Scalars['String']>;
  parent_name?: Maybe<Scalars['String']>;
  pll_case_key?: Maybe<Scalars['String']>;
  recognition_time?: Maybe<Scalars['Float']>;
  skipped?: Maybe<Scalars['Boolean']>;
  solve?: Maybe<Solve>;
  solve_id?: Maybe<Scalars['String']>;
  step_index?: Maybe<Scalars['Int']>;
  step_name?: Maybe<Scalars['String']>;
  total_time?: Maybe<Scalars['Float']>;
  tps?: Maybe<Scalars['Float']>;
  turn_count?: Maybe<Scalars['Int']>;
  turns?: Maybe<Scalars['String']>;
};

export enum SolvesFilter {
  Dnf = 'DNF',
  Imported = 'IMPORTED',
  NotDnf = 'NOT_DNF',
  NotImported = 'NOT_IMPORTED',
  NotPlusTwo = 'NOT_PLUS_TWO',
  NotSmart = 'NOT_SMART',
  PlusTwo = 'PLUS_TWO',
  Smart = 'SMART'
}

export enum SolvesSortBy {
  CreatedAtAsc = 'CREATED_AT_ASC',
  CreatedAtDesc = 'CREATED_AT_DESC',
  TimeAsc = 'TIME_ASC',
  TimeDesc = 'TIME_DESC'
}

export type SolveView = {
  __typename?: 'SolveView';
  created_at?: Maybe<Scalars['DateTime']>;
  id?: Maybe<Scalars['String']>;
  solve_id?: Maybe<Scalars['String']>;
  user?: Maybe<PublicUserAccount>;
  user_id?: Maybe<Scalars['String']>;
  viewer?: Maybe<PublicUserAccount>;
  viewer_id?: Maybe<Scalars['String']>;
};

export type Stats = {
  __typename?: 'Stats';
  profile_views?: Maybe<Scalars['Float']>;
  solve_views?: Maybe<Scalars['Float']>;
};

export type StatsModule = {
  __typename?: 'StatsModule';
  blocks?: Maybe<Array<Maybe<StatsModuleBlock>>>;
};

export type StatsModuleBlock = {
  __typename?: 'StatsModuleBlock';
  averageCount?: Maybe<Scalars['Int']>;
  colorName?: Maybe<Scalars['String']>;
  session?: Maybe<Scalars['Boolean']>;
  sortBy?: Maybe<Scalars['String']>;
  statType?: Maybe<Scalars['String']>;
};

export type StatsModuleBlockInput = {
  averageCount?: InputMaybe<Scalars['Int']>;
  colorName?: InputMaybe<Scalars['String']>;
  session?: InputMaybe<Scalars['Boolean']>;
  sortBy?: InputMaybe<Scalars['String']>;
  statType?: InputMaybe<Scalars['String']>;
};

export type Store = {
  __typename?: 'Store';
  json?: Maybe<Scalars['String']>;
};

export type TimerBackground = {
  __typename?: 'TimerBackground';
  created_at?: Maybe<Scalars['DateTime']>;
  hex?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  storage_path?: Maybe<Scalars['String']>;
  url?: Maybe<Scalars['String']>;
  user?: Maybe<PublicUserAccount>;
  user_id?: Maybe<Scalars['String']>;
};

export type TopAverage = {
  __typename?: 'TopAverage';
  created_at?: Maybe<Scalars['DateTime']>;
  cube_type?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  solve_1?: Maybe<Solve>;
  solve_2?: Maybe<Solve>;
  solve_3?: Maybe<Solve>;
  solve_4?: Maybe<Solve>;
  solve_5?: Maybe<Solve>;
  time?: Maybe<Scalars['Float']>;
  user?: Maybe<PublicUserAccount>;
};

export type TopSolve = {
  __typename?: 'TopSolve';
  created_at?: Maybe<Scalars['DateTime']>;
  cube_type?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  solve?: Maybe<Solve>;
  time?: Maybe<Scalars['Float']>;
  user?: Maybe<PublicUserAccount>;
};

export type TrainerAlgorithm = {
  __typename?: 'TrainerAlgorithm';
  active?: Maybe<Scalars['Boolean']>;
  algo_type?: Maybe<Scalars['String']>;
  colors?: Maybe<Scalars['String']>;
  cube_type?: Maybe<Scalars['String']>;
  group_name?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  img_link?: Maybe<Scalars['String']>;
  name?: Maybe<Scalars['String']>;
  pro_only?: Maybe<Scalars['Boolean']>;
  rotate?: Maybe<Scalars['Float']>;
  scrambles?: Maybe<Scalars['String']>;
  solution?: Maybe<Scalars['String']>;
};

export type TrainerAlternative = {
  __typename?: 'TrainerAlternative';
  algorithm?: Maybe<Scalars['String']>;
  case_name?: Maybe<Scalars['String']>;
  category?: Maybe<Scalars['String']>;
  created_at?: Maybe<Scalars['DateTime']>;
  id?: Maybe<Scalars['String']>;
  ll_pattern?: Maybe<Scalars['String']>;
  original_input?: Maybe<Scalars['String']>;
  setup?: Maybe<Scalars['String']>;
  subset?: Maybe<Scalars['String']>;
  user_id?: Maybe<Scalars['String']>;
};

export type TrainerAlternativeCreateInput = {
  algorithm: Scalars['String'];
  case_name: Scalars['String'];
  category: Scalars['String'];
  ll_pattern?: InputMaybe<Scalars['String']>;
  original_input: Scalars['String'];
  setup?: InputMaybe<Scalars['String']>;
  subset: Scalars['String'];
};

export type TrainerFavorite = {
  __typename?: 'TrainerFavorite';
  created_at?: Maybe<Scalars['DateTime']>;
  cube_key?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  user_id?: Maybe<Scalars['String']>;
};

export type UnreadAnnouncementCount = {
  __typename?: 'UnreadAnnouncementCount';
  count?: Maybe<Scalars['Int']>;
};

export type UpdateAnnouncementInput = {
  category?: InputMaybe<Scalars['String']>;
  content?: InputMaybe<Scalars['String']>;
  imageUrl?: InputMaybe<Scalars['String']>;
  isActive?: InputMaybe<Scalars['Boolean']>;
  isDraft?: InputMaybe<Scalars['Boolean']>;
  priority?: InputMaybe<Scalars['Int']>;
  title?: InputMaybe<Scalars['String']>;
  translations?: InputMaybe<Scalars['String']>;
};

export type UpdateSiteConfigInput = {
  battle_enabled?: InputMaybe<Scalars['Boolean']>;
  community_enabled?: InputMaybe<Scalars['Boolean']>;
  leaderboards_enabled?: InputMaybe<Scalars['Boolean']>;
  maintenance_mode?: InputMaybe<Scalars['Boolean']>;
  rooms_enabled?: InputMaybe<Scalars['Boolean']>;
  trainer_enabled?: InputMaybe<Scalars['Boolean']>;
};

export type UserAccount = IPublicUserAccount & IUserAccount & {
  __typename?: 'UserAccount';
  admin?: Maybe<Scalars['Boolean']>;
  badges?: Maybe<Array<Maybe<Badge>>>;
  banned_forever?: Maybe<Scalars['Boolean']>;
  banned_until?: Maybe<Scalars['DateTime']>;
  bans?: Maybe<Array<Maybe<BanLog>>>;
  created_at?: Maybe<Scalars['DateTime']>;
  email?: Maybe<Scalars['String']>;
  first_name?: Maybe<Scalars['String']>;
  has_password?: Maybe<Scalars['Boolean']>;
  id?: Maybe<Scalars['String']>;
  integrations?: Maybe<Array<Maybe<Integration>>>;
  is_premium?: Maybe<Scalars['Boolean']>;
  is_pro?: Maybe<Scalars['Boolean']>;
  join_country?: Maybe<Scalars['String']>;
  last_name?: Maybe<Scalars['String']>;
  last_solve_at?: Maybe<Scalars['DateTime']>;
  mod?: Maybe<Scalars['Boolean']>;
  offline_hash?: Maybe<Scalars['String']>;
  premium_expires_at?: Maybe<Scalars['DateTime']>;
  pro_expires_at?: Maybe<Scalars['DateTime']>;
  profile?: Maybe<Profile>;
  timer_background?: Maybe<TimerBackground>;
  top_averages?: Maybe<Array<Maybe<TopAverage>>>;
  top_solves?: Maybe<Array<Maybe<TopSolve>>>;
  username?: Maybe<Scalars['String']>;
  verified?: Maybe<Scalars['Boolean']>;
};

export type UserAccountForAdmin = IPublicUserAccount & IUserAccount & IUserAccountForAdmin & {
  __typename?: 'UserAccountForAdmin';
  admin?: Maybe<Scalars['Boolean']>;
  badges?: Maybe<Array<Maybe<Badge>>>;
  banned_forever?: Maybe<Scalars['Boolean']>;
  banned_until?: Maybe<Scalars['DateTime']>;
  bans?: Maybe<Array<Maybe<BanLog>>>;
  created_at?: Maybe<Scalars['DateTime']>;
  email?: Maybe<Scalars['String']>;
  email_verified?: Maybe<Scalars['Boolean']>;
  first_name?: Maybe<Scalars['String']>;
  has_password?: Maybe<Scalars['Boolean']>;
  id?: Maybe<Scalars['String']>;
  integrations?: Maybe<Array<Maybe<Integration>>>;
  is_premium?: Maybe<Scalars['Boolean']>;
  is_pro?: Maybe<Scalars['Boolean']>;
  join_country?: Maybe<Scalars['String']>;
  join_ip?: Maybe<Scalars['String']>;
  last_name?: Maybe<Scalars['String']>;
  last_solve_at?: Maybe<Scalars['DateTime']>;
  mod?: Maybe<Scalars['Boolean']>;
  notification_preferences?: Maybe<NotificationPreference>;
  offline_hash?: Maybe<Scalars['String']>;
  premium_expires_at?: Maybe<Scalars['DateTime']>;
  pro_expires_at?: Maybe<Scalars['DateTime']>;
  profile?: Maybe<Profile>;
  pushTokens?: Maybe<Array<PushTokenInfo>>;
  reports_for?: Maybe<Array<Maybe<Report>>>;
  settings?: Maybe<Setting>;
  summary?: Maybe<UserAccountSummary>;
  timer_background?: Maybe<TimerBackground>;
  top_averages?: Maybe<Array<Maybe<TopAverage>>>;
  top_solves?: Maybe<Array<Maybe<TopSolve>>>;
  username?: Maybe<Scalars['String']>;
  verified?: Maybe<Scalars['Boolean']>;
};

export type UserAccountSolvesSummary = {
  __typename?: 'UserAccountSolvesSummary';
  average?: Maybe<Scalars['Float']>;
  count?: Maybe<Scalars['Float']>;
  cube_type?: Maybe<Scalars['String']>;
  max_time?: Maybe<Scalars['Float']>;
  min_time?: Maybe<Scalars['Float']>;
  sum?: Maybe<Scalars['Float']>;
};

export type UserAccountSummary = {
  __typename?: 'UserAccountSummary';
  bans?: Maybe<Scalars['Int']>;
  profile_views?: Maybe<Scalars['Int']>;
  reports_created?: Maybe<Scalars['Int']>;
  reports_for?: Maybe<Scalars['Int']>;
  solves?: Maybe<Scalars['Int']>;
  timer_solves?: Maybe<Array<Maybe<UserAccountSolvesSummary>>>;
};

export type WcaAccount = {
  __typename?: 'WcaAccount';
  country_iso2?: Maybe<Scalars['String']>;
  created_at?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  url?: Maybe<Scalars['String']>;
  wca_id?: Maybe<Scalars['String']>;
};

export type WcaCompetition = {
  __typename?: 'WcaCompetition';
  city?: Maybe<Scalars['String']>;
  competitor_limit?: Maybe<Scalars['Int']>;
  country_iso2?: Maybe<Scalars['String']>;
  date_range?: Maybe<Scalars['String']>;
  end_date?: Maybe<Scalars['String']>;
  event_ids?: Maybe<Array<Maybe<Scalars['String']>>>;
  id?: Maybe<Scalars['String']>;
  latitude_degrees?: Maybe<Scalars['Float']>;
  longitude_degrees?: Maybe<Scalars['Float']>;
  name?: Maybe<Scalars['String']>;
  start_date?: Maybe<Scalars['String']>;
  url?: Maybe<Scalars['String']>;
  venue?: Maybe<Scalars['String']>;
};

export type WcaCompetitionDetail = {
  __typename?: 'WcaCompetitionDetail';
  allPersonalBests?: Maybe<Array<Maybe<WcaRankingRow>>>;
  competitionId?: Maybe<Scalars['String']>;
  competitionName?: Maybe<Scalars['String']>;
  competitors?: Maybe<Array<Maybe<WcaCompetitor>>>;
  events?: Maybe<Array<Maybe<WcaEventDetail>>>;
  info?: Maybe<WcaCompetitionInfo>;
  myRegisteredEvents?: Maybe<Array<Maybe<Scalars['String']>>>;
  myRegistrationStatus?: Maybe<Scalars['String']>;
  myWcaId?: Maybe<Scalars['String']>;
  schedule?: Maybe<Array<Maybe<WcaScheduleDay>>>;
  wcaLiveCompetitors?: Maybe<Array<Maybe<WcaLiveCompetitor>>>;
  wcaLiveCompId?: Maybe<Scalars['String']>;
  wcaLiveRoundMap?: Maybe<Array<Maybe<WcaLiveRoundMapping>>>;
};

export type WcaCompetitionFilterInput = {
  country_iso2?: InputMaybe<Scalars['String']>;
};

export type WcaCompetitionInfo = {
  __typename?: 'WcaCompetitionInfo';
  delegates?: Maybe<Array<Maybe<WcaPersonInfo>>>;
  organizers?: Maybe<Array<Maybe<WcaPersonInfo>>>;
  venues?: Maybe<Array<Maybe<WcaVenueInfo>>>;
  wcaUrl?: Maybe<Scalars['String']>;
};

export type WcaCompetitor = {
  __typename?: 'WcaCompetitor';
  assignments?: Maybe<Array<Maybe<WcaCompetitorAssignment>>>;
  avatar?: Maybe<Scalars['String']>;
  country?: Maybe<Scalars['String']>;
  name?: Maybe<Scalars['String']>;
  personalBests?: Maybe<Array<Maybe<WcaPersonalBest>>>;
  registeredEvents?: Maybe<Array<Maybe<Scalars['String']>>>;
  registrantId?: Maybe<Scalars['Int']>;
  wcaId?: Maybe<Scalars['String']>;
  wcaUserId?: Maybe<Scalars['Int']>;
};

export type WcaCompetitorAssignment = {
  __typename?: 'WcaCompetitorAssignment';
  activityCode?: Maybe<Scalars['String']>;
  assignmentCode?: Maybe<Scalars['String']>;
  endTime?: Maybe<Scalars['String']>;
  eventName?: Maybe<Scalars['String']>;
  groupNumber?: Maybe<Scalars['Int']>;
  roomName?: Maybe<Scalars['String']>;
  roundNumber?: Maybe<Scalars['Int']>;
  startTime?: Maybe<Scalars['String']>;
  stationNumber?: Maybe<Scalars['Int']>;
};

export type WcaEventDetail = {
  __typename?: 'WcaEventDetail';
  eventId?: Maybe<Scalars['String']>;
  eventName?: Maybe<Scalars['String']>;
  rounds?: Maybe<Array<Maybe<WcaRound>>>;
};

export type WcaGroup = {
  __typename?: 'WcaGroup';
  activityCode?: Maybe<Scalars['String']>;
  competitors?: Maybe<Array<Maybe<WcaGroupCompetitor>>>;
  endTime?: Maybe<Scalars['String']>;
  groupNumber?: Maybe<Scalars['Int']>;
  startTime?: Maybe<Scalars['String']>;
};

export type WcaGroupCompetitor = {
  __typename?: 'WcaGroupCompetitor';
  assignmentCode?: Maybe<Scalars['String']>;
  name?: Maybe<Scalars['String']>;
  registrantId?: Maybe<Scalars['Int']>;
  seedResult?: Maybe<Scalars['Int']>;
  wcaId?: Maybe<Scalars['String']>;
};

export type WcaLiveAdvancementCondition = {
  __typename?: 'WcaLiveAdvancementCondition';
  level?: Maybe<Scalars['Int']>;
  type?: Maybe<Scalars['String']>;
};

export type WcaLiveAttempt = {
  __typename?: 'WcaLiveAttempt';
  result?: Maybe<Scalars['Int']>;
};

export type WcaLiveCompetitionOverview = {
  __typename?: 'WcaLiveCompetitionOverview';
  compId?: Maybe<Scalars['String']>;
  events?: Maybe<Array<Maybe<WcaLiveEventInfo>>>;
  name?: Maybe<Scalars['String']>;
  podiums?: Maybe<Array<Maybe<WcaLivePodium>>>;
  records?: Maybe<Array<Maybe<WcaLiveRecord>>>;
  schedule?: Maybe<Array<Maybe<WcaLiveScheduleVenue>>>;
};

export type WcaLiveCompetitor = {
  __typename?: 'WcaLiveCompetitor';
  liveId?: Maybe<Scalars['String']>;
  wcaId?: Maybe<Scalars['String']>;
};

export type WcaLiveCompetitorInput = {
  competitionId?: InputMaybe<Scalars['String']>;
  personLiveId?: InputMaybe<Scalars['String']>;
};

export type WcaLiveCompetitorResultEntry = {
  __typename?: 'WcaLiveCompetitorResultEntry';
  advancing?: Maybe<Scalars['Boolean']>;
  advancingQuestionable?: Maybe<Scalars['Boolean']>;
  attempts?: Maybe<Array<Maybe<WcaLiveAttempt>>>;
  average?: Maybe<Scalars['Int']>;
  averageRecordTag?: Maybe<Scalars['String']>;
  best?: Maybe<Scalars['Int']>;
  eventId?: Maybe<Scalars['String']>;
  eventName?: Maybe<Scalars['String']>;
  format?: Maybe<WcaLiveFormat>;
  ranking?: Maybe<Scalars['Int']>;
  roundName?: Maybe<Scalars['String']>;
  roundNumber?: Maybe<Scalars['Int']>;
  singleRecordTag?: Maybe<Scalars['String']>;
};

export type WcaLiveCompetitorResults = {
  __typename?: 'WcaLiveCompetitorResults';
  personCountryIso2?: Maybe<Scalars['String']>;
  personName?: Maybe<Scalars['String']>;
  personWcaId?: Maybe<Scalars['String']>;
  results?: Maybe<Array<Maybe<WcaLiveCompetitorResultEntry>>>;
};

export type WcaLiveCutoff = {
  __typename?: 'WcaLiveCutoff';
  attemptResult?: Maybe<Scalars['Int']>;
  numberOfAttempts?: Maybe<Scalars['Int']>;
};

export type WcaLiveEventInfo = {
  __typename?: 'WcaLiveEventInfo';
  eventId?: Maybe<Scalars['String']>;
  eventName?: Maybe<Scalars['String']>;
  rounds?: Maybe<Array<Maybe<WcaLiveRoundInfo>>>;
};

export type WcaLiveFormat = {
  __typename?: 'WcaLiveFormat';
  numberOfAttempts?: Maybe<Scalars['Int']>;
  sortBy?: Maybe<Scalars['String']>;
};

export type WcaLiveOverviewInput = {
  competitionId?: InputMaybe<Scalars['String']>;
};

export type WcaLivePodium = {
  __typename?: 'WcaLivePodium';
  entries?: Maybe<Array<Maybe<WcaLivePodiumEntry>>>;
  eventId?: Maybe<Scalars['String']>;
  eventName?: Maybe<Scalars['String']>;
  sortBy?: Maybe<Scalars['String']>;
};

export type WcaLivePodiumEntry = {
  __typename?: 'WcaLivePodiumEntry';
  average?: Maybe<Scalars['Int']>;
  averageRecordTag?: Maybe<Scalars['String']>;
  best?: Maybe<Scalars['Int']>;
  personCountryIso2?: Maybe<Scalars['String']>;
  personName?: Maybe<Scalars['String']>;
  ranking?: Maybe<Scalars['Int']>;
  singleRecordTag?: Maybe<Scalars['String']>;
};

export type WcaLiveRecord = {
  __typename?: 'WcaLiveRecord';
  attemptResult?: Maybe<Scalars['Int']>;
  eventId?: Maybe<Scalars['String']>;
  eventName?: Maybe<Scalars['String']>;
  personCountryIso2?: Maybe<Scalars['String']>;
  personName?: Maybe<Scalars['String']>;
  roundNumber?: Maybe<Scalars['Int']>;
  tag?: Maybe<Scalars['String']>;
  type?: Maybe<Scalars['String']>;
};

export type WcaLiveResult = {
  __typename?: 'WcaLiveResult';
  advancing?: Maybe<Scalars['Boolean']>;
  advancingQuestionable?: Maybe<Scalars['Boolean']>;
  attempts?: Maybe<Array<Maybe<WcaLiveAttempt>>>;
  average?: Maybe<Scalars['Int']>;
  averageRecordTag?: Maybe<Scalars['String']>;
  best?: Maybe<Scalars['Int']>;
  personCountryIso2?: Maybe<Scalars['String']>;
  personLiveId?: Maybe<Scalars['String']>;
  personName?: Maybe<Scalars['String']>;
  personWcaId?: Maybe<Scalars['String']>;
  ranking?: Maybe<Scalars['Int']>;
  singleRecordTag?: Maybe<Scalars['String']>;
};

export type WcaLiveRoundInfo = {
  __typename?: 'WcaLiveRoundInfo';
  active?: Maybe<Scalars['Boolean']>;
  advancementCondition?: Maybe<WcaLiveAdvancementCondition>;
  cutoff?: Maybe<WcaLiveCutoff>;
  finished?: Maybe<Scalars['Boolean']>;
  format?: Maybe<WcaLiveFormat>;
  liveRoundId?: Maybe<Scalars['String']>;
  name?: Maybe<Scalars['String']>;
  number?: Maybe<Scalars['Int']>;
  numEntered?: Maybe<Scalars['Int']>;
  numResults?: Maybe<Scalars['Int']>;
  open?: Maybe<Scalars['Boolean']>;
  timeLimit?: Maybe<WcaLiveTimeLimit>;
};

export type WcaLiveRoundInput = {
  competitionId?: InputMaybe<Scalars['String']>;
  liveRoundId?: InputMaybe<Scalars['String']>;
};

export type WcaLiveRoundMapping = {
  __typename?: 'WcaLiveRoundMapping';
  activityCode?: Maybe<Scalars['String']>;
  liveRoundId?: Maybe<Scalars['String']>;
};

export type WcaLiveRoundResults = {
  __typename?: 'WcaLiveRoundResults';
  active?: Maybe<Scalars['Boolean']>;
  finished?: Maybe<Scalars['Boolean']>;
  numberOfAttempts?: Maybe<Scalars['Int']>;
  results?: Maybe<Array<Maybe<WcaLiveResult>>>;
  roundActivityCode?: Maybe<Scalars['String']>;
  roundName?: Maybe<Scalars['String']>;
  sortBy?: Maybe<Scalars['String']>;
};

export type WcaLiveScheduleActivity = {
  __typename?: 'WcaLiveScheduleActivity';
  activityCode?: Maybe<Scalars['String']>;
  activityId?: Maybe<Scalars['Int']>;
  endTime?: Maybe<Scalars['String']>;
  name?: Maybe<Scalars['String']>;
  startTime?: Maybe<Scalars['String']>;
};

export type WcaLiveScheduleRoom = {
  __typename?: 'WcaLiveScheduleRoom';
  activities?: Maybe<Array<Maybe<WcaLiveScheduleActivity>>>;
  color?: Maybe<Scalars['String']>;
  name?: Maybe<Scalars['String']>;
};

export type WcaLiveScheduleVenue = {
  __typename?: 'WcaLiveScheduleVenue';
  name?: Maybe<Scalars['String']>;
  rooms?: Maybe<Array<Maybe<WcaLiveScheduleRoom>>>;
};

export type WcaLiveTimeLimit = {
  __typename?: 'WcaLiveTimeLimit';
  centiseconds?: Maybe<Scalars['Int']>;
  cumulativeRoundWcifIds?: Maybe<Array<Maybe<Scalars['String']>>>;
};

export type WcaOAuthResult = {
  __typename?: 'WcaOAuthResult';
  needsUsername?: Maybe<Scalars['Boolean']>;
  success?: Maybe<Scalars['Boolean']>;
  wcaEmail?: Maybe<Scalars['String']>;
  wcaId?: Maybe<Scalars['String']>;
  wcaName?: Maybe<Scalars['String']>;
};

export type WcaPersonalBest = {
  __typename?: 'WcaPersonalBest';
  best?: Maybe<Scalars['Int']>;
  continentalRanking?: Maybe<Scalars['Int']>;
  eventId?: Maybe<Scalars['String']>;
  nationalRanking?: Maybe<Scalars['Int']>;
  type?: Maybe<Scalars['String']>;
  worldRanking?: Maybe<Scalars['Int']>;
};

export type WcaPersonInfo = {
  __typename?: 'WcaPersonInfo';
  avatar?: Maybe<Scalars['String']>;
  name?: Maybe<Scalars['String']>;
  role?: Maybe<Scalars['String']>;
  wcaId?: Maybe<Scalars['String']>;
};

export type WcaRankingRow = {
  __typename?: 'WcaRankingRow';
  average?: Maybe<Scalars['Int']>;
  averageWorldRank?: Maybe<Scalars['Int']>;
  eventId?: Maybe<Scalars['String']>;
  name?: Maybe<Scalars['String']>;
  registrantId?: Maybe<Scalars['Int']>;
  single?: Maybe<Scalars['Int']>;
  singleWorldRank?: Maybe<Scalars['Int']>;
  wcaId?: Maybe<Scalars['String']>;
};

export type WcaRecord = {
  __typename?: 'WcaRecord';
  average_continent_rank?: Maybe<Scalars['Float']>;
  average_country_rank?: Maybe<Scalars['Float']>;
  average_record?: Maybe<Scalars['Float']>;
  average_world_rank?: Maybe<Scalars['Float']>;
  created_at?: Maybe<Scalars['DateTime']>;
  fetched_at?: Maybe<Scalars['DateTime']>;
  id?: Maybe<Scalars['ID']>;
  integration?: Maybe<Integration>;
  integration_id?: Maybe<Scalars['String']>;
  published?: Maybe<Scalars['Boolean']>;
  single_continent_rank?: Maybe<Scalars['Float']>;
  single_country_rank?: Maybe<Scalars['Float']>;
  single_record?: Maybe<Scalars['Float']>;
  single_world_rank?: Maybe<Scalars['Float']>;
  updated_at?: Maybe<Scalars['DateTime']>;
  user?: Maybe<PublicUserAccount>;
  user_id?: Maybe<Scalars['String']>;
  wca_event?: Maybe<Scalars['String']>;
};

export type WcaResult = {
  __typename?: 'WcaResult';
  attempts?: Maybe<Array<Maybe<Scalars['Int']>>>;
  average?: Maybe<Scalars['Int']>;
  best?: Maybe<Scalars['Int']>;
  competition_date?: Maybe<Scalars['String']>;
  competition_id?: Maybe<Scalars['String']>;
  competition_name?: Maybe<Scalars['String']>;
  event_id?: Maybe<Scalars['String']>;
  pos?: Maybe<Scalars['Int']>;
  regional_average_record?: Maybe<Scalars['String']>;
  regional_single_record?: Maybe<Scalars['String']>;
  round_type_id?: Maybe<Scalars['String']>;
};

export type WcaRound = {
  __typename?: 'WcaRound';
  advancementLevel?: Maybe<Scalars['Int']>;
  advancementType?: Maybe<Scalars['String']>;
  cutoff?: Maybe<Scalars['Int']>;
  cutoffAttempts?: Maybe<Scalars['Int']>;
  format?: Maybe<Scalars['String']>;
  groups?: Maybe<Array<Maybe<WcaGroup>>>;
  roundNumber?: Maybe<Scalars['Int']>;
  timeLimit?: Maybe<Scalars['Int']>;
};

export type WcaScheduleAssignment = {
  __typename?: 'WcaScheduleAssignment';
  activityCode?: Maybe<Scalars['String']>;
  assignmentCode?: Maybe<Scalars['String']>;
  endTime?: Maybe<Scalars['String']>;
  eventName?: Maybe<Scalars['String']>;
  groupNumber?: Maybe<Scalars['Int']>;
  roomColor?: Maybe<Scalars['String']>;
  roomName?: Maybe<Scalars['String']>;
  roundNumber?: Maybe<Scalars['Int']>;
  startTime?: Maybe<Scalars['String']>;
  stationNumber?: Maybe<Scalars['Int']>;
  venueName?: Maybe<Scalars['String']>;
};

export type WcaScheduleDay = {
  __typename?: 'WcaScheduleDay';
  assignments?: Maybe<Array<Maybe<WcaScheduleAssignment>>>;
  date?: Maybe<Scalars['String']>;
};

export type WcaScheduleInput = {
  competitionId?: InputMaybe<Scalars['String']>;
};

export type WcaVenueInfo = {
  __typename?: 'WcaVenueInfo';
  address?: Maybe<Scalars['String']>;
  city?: Maybe<Scalars['String']>;
  name?: Maybe<Scalars['String']>;
};

export type YouTubeSearchInput = {
  query?: InputMaybe<Scalars['String']>;
};

export type YouTubeVideoResult = {
  __typename?: 'YouTubeVideoResult';
  channelTitle?: Maybe<Scalars['String']>;
  thumbnail?: Maybe<Scalars['String']>;
  title?: Maybe<Scalars['String']>;
  videoId?: Maybe<Scalars['String']>;
};

export type MiniSolveFragmentFragment = { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, session_id?: string | null, trainer_name?: string | null, bulk?: boolean | null, scramble?: string | null, from_timer?: boolean | null, training_session_id?: string | null, dnf?: boolean | null, plus_two?: boolean | null, is_smart_cube?: boolean | null, created_at?: any | null, started_at?: any | null, ended_at?: any | null };

export type StatsFragmentFragment = { __typename?: 'Stats', profile_views?: number | null, solve_views?: number | null };

export type StatsModuleBlockFragmentFragment = { __typename?: 'StatsModuleBlock', statType?: string | null, sortBy?: string | null, session?: boolean | null, colorName?: string | null, averageCount?: number | null };

export type AlgorithmOverrideFragmentFragment = { __typename?: 'AlgorithmOverride', cube_key?: string | null, rotate?: number | null, solution?: string | null };

export type TrainerFavoriteFragmentFragment = { __typename?: 'TrainerFavorite', cube_key?: string | null };

export type TrainerAlgorithmFragmentFragment = { __typename?: 'TrainerAlgorithm', id?: string | null, name?: string | null, scrambles?: string | null, solution?: string | null, pro_only?: boolean | null, cube_type?: string | null, algo_type?: string | null, colors?: string | null, group_name?: string | null };

export type SessionFragmentFragment = { __typename?: 'Session', id?: string | null, name?: string | null, created_at?: any | null, order?: number | null };

export type SolveFragmentFragment = { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null };

export type CustomCubeTypeFragmentFragment = { __typename?: 'CustomCubeType', id?: string | null, user_id?: string | null, name?: string | null, created_at?: any | null, scramble?: string | null, private?: boolean | null };

export type SettingsFragmentFragment = { __typename?: 'Setting', id?: string | null, user_id?: string | null, focus_mode?: boolean | null, freeze_time?: number | null, inspection?: boolean | null, manual_entry?: boolean | null, inspection_delay?: number | null, session_id?: string | null, inverse_time_list?: boolean | null, hide_time_when_solving?: boolean | null, nav_collapsed?: boolean | null, timer_decimal_points?: number | null, pb_confetti?: boolean | null, play_inspection_sound?: boolean | null, zero_out_time_after_solve?: boolean | null, confirm_delete_solve?: boolean | null, use_space_with_smart_cube?: boolean | null, use_2d_scramble_visual?: boolean | null, require_period_in_manual_time_entry?: boolean | null, cube_type?: string | null, custom_cube_types?: Array<{ __typename?: 'CustomCubeType', id?: string | null, user_id?: string | null, name?: string | null, created_at?: any | null, scramble?: string | null, private?: boolean | null } | null> | null };

export type ImageFragmentFragment = { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null };

type PublicUserFragment_InternalUserAccount_Fragment = { __typename?: 'InternalUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null };

type PublicUserFragment_PublicUserAccount_Fragment = { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null };

type PublicUserFragment_UserAccount_Fragment = { __typename?: 'UserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null };

type PublicUserFragment_UserAccountForAdmin_Fragment = { __typename?: 'UserAccountForAdmin', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null };

export type PublicUserFragmentFragment = PublicUserFragment_InternalUserAccount_Fragment | PublicUserFragment_PublicUserAccount_Fragment | PublicUserFragment_UserAccount_Fragment | PublicUserFragment_UserAccountForAdmin_Fragment;

type PublicUserWithEloFragment_InternalUserAccount_Fragment = { __typename?: 'InternalUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null };

type PublicUserWithEloFragment_PublicUserAccount_Fragment = { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null };

type PublicUserWithEloFragment_UserAccount_Fragment = { __typename?: 'UserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null };

type PublicUserWithEloFragment_UserAccountForAdmin_Fragment = { __typename?: 'UserAccountForAdmin', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null };

export type PublicUserWithEloFragmentFragment = PublicUserWithEloFragment_InternalUserAccount_Fragment | PublicUserWithEloFragment_PublicUserAccount_Fragment | PublicUserWithEloFragment_UserAccount_Fragment | PublicUserWithEloFragment_UserAccountForAdmin_Fragment;

type UserAccountFragment_InternalUserAccount_Fragment = { __typename?: 'InternalUserAccount', email?: string | null, offline_hash?: string | null, id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null };

type UserAccountFragment_UserAccount_Fragment = { __typename?: 'UserAccount', email?: string | null, offline_hash?: string | null, id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null };

type UserAccountFragment_UserAccountForAdmin_Fragment = { __typename?: 'UserAccountForAdmin', email?: string | null, offline_hash?: string | null, id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null };

export type UserAccountFragmentFragment = UserAccountFragment_InternalUserAccount_Fragment | UserAccountFragment_UserAccount_Fragment | UserAccountFragment_UserAccountForAdmin_Fragment;

export type SolveWithUserFragmentFragment = { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null };

export type NotificationPreferenceFragmentFragment = { __typename?: 'NotificationPreference', marketing_emails?: boolean | null };

export type NotificationFragmentFragment = { __typename?: 'Notification', id?: string | null, user_id?: string | null, notification_type?: string | null, notification_category_name?: string | null, triggering_user_id?: string | null, in_app_message?: string | null, read_at?: any | null, message?: string | null, icon?: string | null, link?: string | null, link_text?: string | null, subject?: string | null, created_at?: any | null, triggering_user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null };

export type TopSolveFragmentFragment = { __typename?: 'TopSolve', id?: string | null, time?: number | null, cube_type?: string | null, created_at?: any | null, solve?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null };

export type TopAverageFragmentFragment = { __typename?: 'TopAverage', id?: string | null, time?: number | null, cube_type?: string | null, created_at?: any | null, solve_1?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, solve_2?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, solve_3?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, solve_4?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, solve_5?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null };

export type ProfileFragmentFragment = { __typename?: 'Profile', id?: string | null, bio?: string | null, three_method?: string | null, three_goal?: string | null, main_three_cube?: string | null, favorite_event?: string | null, youtube_link?: string | null, twitter_link?: string | null, user_id?: string | null, reddit_link?: string | null, twitch_link?: string | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, top_solves?: Array<{ __typename?: 'TopSolve', id?: string | null, time?: number | null, cube_type?: string | null, created_at?: any | null, solve?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null } | null> | null, top_averages?: Array<{ __typename?: 'TopAverage', id?: string | null, time?: number | null, cube_type?: string | null, created_at?: any | null, solve_1?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, solve_2?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, solve_3?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, solve_4?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, solve_5?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null } | null> | null, header_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null, pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null };

export type ReportFragmentFragment = { __typename?: 'Report', id?: string | null, reported_user_id?: string | null, created_by_id?: string | null, reason?: string | null, resolved_at?: any | null, created_at?: any | null, created_by?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, reported_user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null };

export type IntegrationFragmentFragment = { __typename?: 'Integration', id?: string | null, auth_expires_at?: any | null, service_name?: IntegrationType | null, created_at?: any | null };

export type CustomTrainerFragmentFragment = { __typename?: 'CustomTrainer', id?: string | null, solution?: string | null, scrambles?: string | null, colors?: string | null, description?: string | null, alt_solutions?: string | null, group_name?: string | null, algo_type?: string | null, three_d?: boolean | null, cube_type?: string | null, name?: string | null, key?: string | null, copy_of_id?: string | null, copy_of?: { __typename?: 'CustomTrainer', user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null } | null } | null };

export type PublicCustomTrainerRecordFragmentFragment = { __typename?: 'CustomTrainer', user_id?: string | null, like_count?: number | null, id?: string | null, solution?: string | null, scrambles?: string | null, colors?: string | null, description?: string | null, alt_solutions?: string | null, group_name?: string | null, algo_type?: string | null, three_d?: boolean | null, cube_type?: string | null, name?: string | null, key?: string | null, copy_of_id?: string | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, copy_of?: { __typename?: 'CustomTrainer', user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null } | null } | null };

export type TimerBackgroundFragmentFragment = { __typename?: 'TimerBackground', created_at?: any | null, hex?: string | null, storage_path?: string | null, id?: string | null, url?: string | null };

type UserForMeFragment_InternalUserAccount_Fragment = { __typename?: 'InternalUserAccount', email?: string | null, join_country?: string | null, id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, timer_background?: { __typename?: 'TimerBackground', created_at?: any | null, hex?: string | null, storage_path?: string | null, id?: string | null, url?: string | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null };

type UserForMeFragment_UserAccount_Fragment = { __typename?: 'UserAccount', email?: string | null, join_country?: string | null, id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, timer_background?: { __typename?: 'TimerBackground', created_at?: any | null, hex?: string | null, storage_path?: string | null, id?: string | null, url?: string | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null };

type UserForMeFragment_UserAccountForAdmin_Fragment = { __typename?: 'UserAccountForAdmin', email?: string | null, join_country?: string | null, id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, timer_background?: { __typename?: 'TimerBackground', created_at?: any | null, hex?: string | null, storage_path?: string | null, id?: string | null, url?: string | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null };

export type UserForMeFragmentFragment = UserForMeFragment_InternalUserAccount_Fragment | UserForMeFragment_UserAccount_Fragment | UserForMeFragment_UserAccountForAdmin_Fragment;

export type UserAccountSolvesSummaryFragmentFragment = { __typename?: 'UserAccountSolvesSummary', count?: number | null, average?: number | null, min_time?: number | null, max_time?: number | null, sum?: number | null, cube_type?: string | null };

export type UserAccountSummaryFragmentFragment = { __typename?: 'UserAccountSummary', solves?: number | null, reports_for?: number | null, reports_created?: number | null, profile_views?: number | null, bans?: number | null, timer_solves?: Array<{ __typename?: 'UserAccountSolvesSummary', count?: number | null, average?: number | null, min_time?: number | null, max_time?: number | null, sum?: number | null, cube_type?: string | null } | null> | null };

export type UserForAdminFragmentFragment = { __typename?: 'UserAccountForAdmin', email?: string | null, join_country?: string | null, join_ip?: string | null, id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, reports_for?: Array<{ __typename?: 'Report', id?: string | null, reported_user_id?: string | null, created_by_id?: string | null, reason?: string | null, resolved_at?: any | null, created_at?: any | null, created_by?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, reported_user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null } | null> | null, settings?: { __typename?: 'Setting', id?: string | null, user_id?: string | null, focus_mode?: boolean | null, freeze_time?: number | null, inspection?: boolean | null, manual_entry?: boolean | null, inspection_delay?: number | null, session_id?: string | null, inverse_time_list?: boolean | null, hide_time_when_solving?: boolean | null, nav_collapsed?: boolean | null, timer_decimal_points?: number | null, pb_confetti?: boolean | null, play_inspection_sound?: boolean | null, zero_out_time_after_solve?: boolean | null, confirm_delete_solve?: boolean | null, use_space_with_smart_cube?: boolean | null, use_2d_scramble_visual?: boolean | null, require_period_in_manual_time_entry?: boolean | null, cube_type?: string | null, custom_cube_types?: Array<{ __typename?: 'CustomCubeType', id?: string | null, user_id?: string | null, name?: string | null, created_at?: any | null, scramble?: string | null, private?: boolean | null } | null> | null } | null, notification_preferences?: { __typename?: 'NotificationPreference', marketing_emails?: boolean | null } | null, summary?: { __typename?: 'UserAccountSummary', solves?: number | null, reports_for?: number | null, reports_created?: number | null, profile_views?: number | null, bans?: number | null, timer_solves?: Array<{ __typename?: 'UserAccountSolvesSummary', count?: number | null, average?: number | null, min_time?: number | null, max_time?: number | null, sum?: number | null, cube_type?: string | null } | null> | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null };

export type ReportSummaryFragmentFragment = { __typename?: 'ReportSummary', last_report?: any | null, first_report?: any | null, count?: number | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, reports?: Array<{ __typename?: 'Report', id?: string | null, reported_user_id?: string | null, created_by_id?: string | null, reason?: string | null, resolved_at?: any | null, created_at?: any | null, created_by?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, reported_user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null } | null> | null };

export type UpdateSiteConfigMutationVariables = Exact<{
  input: UpdateSiteConfigInput;
}>;


export type UpdateSiteConfigMutation = { __typename?: 'Mutation', updateSiteConfig?: { __typename?: 'SiteConfig', id?: string | null, maintenance_mode?: boolean | null, trainer_enabled?: boolean | null, community_enabled?: boolean | null, leaderboards_enabled?: boolean | null, rooms_enabled?: boolean | null, battle_enabled?: boolean | null, updated_at?: any | null } | null };

export type MergeSessionsMutationVariables = Exact<{
  oldSessionId?: InputMaybe<Scalars['String']>;
  newSessionId?: InputMaybe<Scalars['String']>;
}>;


export type MergeSessionsMutation = { __typename?: 'Mutation', mergeSessions?: { __typename?: 'Session', id?: string | null, name?: string | null, created_at?: any | null, order?: number | null } | null };

export type CreateSessionMutationVariables = Exact<{
  input?: InputMaybe<SessionInput>;
}>;


export type CreateSessionMutation = { __typename?: 'Mutation', createSession?: { __typename?: 'Session', id?: string | null, name?: string | null, created_at?: any | null, order?: number | null } | null };

export type UpdateSessionMutationVariables = Exact<{
  id?: InputMaybe<Scalars['String']>;
  input?: InputMaybe<SessionInput>;
}>;


export type UpdateSessionMutation = { __typename?: 'Mutation', updateSession?: { __typename?: 'Session', id?: string | null, name?: string | null, created_at?: any | null, order?: number | null } | null };

export type DeleteSessionMutationVariables = Exact<{
  id?: InputMaybe<Scalars['String']>;
}>;


export type DeleteSessionMutation = { __typename?: 'Mutation', deleteSession?: { __typename?: 'Session', id?: string | null, name?: string | null, created_at?: any | null, order?: number | null } | null };

export type ReorderSessionsMutationVariables = Exact<{
  ids: Array<InputMaybe<Scalars['String']>> | InputMaybe<Scalars['String']>;
}>;


export type ReorderSessionsMutation = { __typename?: 'Mutation', reorderSessions?: any | null };

export type CreateAnnouncementMutationVariables = Exact<{
  input: CreateAnnouncementInput;
}>;


export type CreateAnnouncementMutation = { __typename?: 'Mutation', createAnnouncement?: { __typename?: 'Announcement', id?: string | null, title?: string | null, category?: string | null, isDraft?: boolean | null } | null };

export type UpdateAnnouncementMutationVariables = Exact<{
  id: Scalars['String'];
  input: UpdateAnnouncementInput;
}>;


export type UpdateAnnouncementMutation = { __typename?: 'Mutation', updateAnnouncement?: { __typename?: 'Announcement', id?: string | null, title?: string | null, category?: string | null, isDraft?: boolean | null } | null };

export type MarkAnnouncementAsViewedMutationVariables = Exact<{
  announcementId: Scalars['String'];
}>;


export type MarkAnnouncementAsViewedMutation = { __typename?: 'Mutation', markAnnouncementAsViewed?: boolean | null };

export type DeleteAnnouncementMutationVariables = Exact<{
  id: Scalars['String'];
}>;


export type DeleteAnnouncementMutation = { __typename?: 'Mutation', deleteAnnouncement?: boolean | null };

export type CreateTrainerAlternativeMutationVariables = Exact<{
  input: TrainerAlternativeCreateInput;
}>;


export type CreateTrainerAlternativeMutation = { __typename?: 'Mutation', createTrainerAlternative?: { __typename?: 'TrainerAlternative', id?: string | null, algorithm?: string | null, original_input?: string | null, setup?: string | null, ll_pattern?: string | null } | null };

export type AdminDeleteTrainerAlternativeMutationVariables = Exact<{
  id: Scalars['String'];
}>;


export type AdminDeleteTrainerAlternativeMutation = { __typename?: 'Mutation', adminDeleteTrainerAlternative?: { __typename?: 'TrainerAlternative', id?: string | null } | null };

export type SiteConfigQueryVariables = Exact<{ [key: string]: never; }>;


export type SiteConfigQuery = { __typename?: 'Query', siteConfig?: { __typename?: 'SiteConfig', id?: string | null, maintenance_mode?: boolean | null, trainer_enabled?: boolean | null, community_enabled?: boolean | null, leaderboards_enabled?: boolean | null, rooms_enabled?: boolean | null, battle_enabled?: boolean | null, updated_at?: any | null } | null };

export type SolveByShareCodeQueryVariables = Exact<{
  shareCode?: InputMaybe<Scalars['String']>;
}>;


export type SolveByShareCodeQuery = { __typename?: 'Query', solveByShareCode?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null };

export type ProfileQueryVariables = Exact<{
  username?: InputMaybe<Scalars['String']>;
}>;


export type ProfileQuery = { __typename?: 'Query', profile: { __typename?: 'Profile', id?: string | null, bio?: string | null, three_method?: string | null, three_goal?: string | null, main_three_cube?: string | null, favorite_event?: string | null, youtube_link?: string | null, twitter_link?: string | null, user_id?: string | null, reddit_link?: string | null, twitch_link?: string | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, top_solves?: Array<{ __typename?: 'TopSolve', id?: string | null, time?: number | null, cube_type?: string | null, created_at?: any | null, solve?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null } | null> | null, top_averages?: Array<{ __typename?: 'TopAverage', id?: string | null, time?: number | null, cube_type?: string | null, created_at?: any | null, solve_1?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, solve_2?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, solve_3?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, solve_4?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, solve_5?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null } | null> | null, header_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null, pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } };

export type UserSearchQueryVariables = Exact<{
  pageArgs?: InputMaybe<PaginationArgsInput>;
}>;


export type UserSearchQuery = { __typename?: 'Query', userSearch?: { __typename?: 'PaginatedUserAccounts', hasMore?: boolean | null, total?: number | null, items?: Array<{ __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null> | null } | null };

export type AdminUserSearchQueryVariables = Exact<{
  pageArgs?: InputMaybe<PaginationArgsInput>;
}>;


export type AdminUserSearchQuery = { __typename?: 'Query', adminUserSearch?: { __typename?: 'PaginatedUserAccountsForAdmin', hasMore?: boolean | null, total?: number | null, items?: Array<{ __typename?: 'UserAccountForAdmin', email?: string | null, offline_hash?: string | null, id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null> | null } | null };

export type GetActiveAnnouncementsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetActiveAnnouncementsQuery = { __typename?: 'Query', getActiveAnnouncements?: Array<{ __typename?: 'Announcement', id?: string | null, title?: string | null, content?: string | null, category?: string | null, priority?: number | null, imageUrl?: string | null, createdAt?: any | null, hasViewed?: boolean | null } | null> | null };

export type GetUnreadAnnouncementCountQueryVariables = Exact<{ [key: string]: never; }>;


export type GetUnreadAnnouncementCountQuery = { __typename?: 'Query', getUnreadAnnouncementCount?: { __typename?: 'UnreadAnnouncementCount', count?: number | null } | null };

export type GetAllAnnouncementsQueryVariables = Exact<{
  filter?: InputMaybe<AnnouncementFilterInput>;
}>;


export type GetAllAnnouncementsQuery = { __typename?: 'Query', getAllAnnouncements?: Array<{ __typename?: 'Announcement', id?: string | null, title?: string | null, content?: string | null, category?: string | null, priority?: number | null, imageUrl?: string | null, isDraft?: boolean | null, isActive?: boolean | null, createdAt?: any | null, publishedAt?: any | null, viewCount?: number | null } | null> | null };

export type GetMyAnnouncementHistoryQueryVariables = Exact<{
  limit: Scalars['Int'];
  offset: Scalars['Int'];
}>;


export type GetMyAnnouncementHistoryQuery = { __typename?: 'Query', getMyAnnouncementHistory?: Array<{ __typename?: 'Announcement', id?: string | null, title?: string | null, content?: string | null, category?: string | null, priority?: number | null, imageUrl?: string | null, createdAt?: any | null } | null> | null };

export type TrainerAlternativesQueryVariables = Exact<{
  category: Scalars['String'];
  caseName: Scalars['String'];
}>;


export type TrainerAlternativesQuery = { __typename?: 'Query', trainerAlternatives?: Array<{ __typename?: 'TrainerAlternative', id?: string | null, algorithm?: string | null, original_input?: string | null, setup?: string | null, ll_pattern?: string | null, created_at?: any | null } | null> | null };

export type WcaCompetitionsQueryVariables = Exact<{
  filter?: InputMaybe<WcaCompetitionFilterInput>;
}>;


export type WcaCompetitionsQuery = { __typename?: 'Query', wcaCompetitions?: Array<{ __typename?: 'WcaCompetition', id?: string | null, name?: string | null, city?: string | null, country_iso2?: string | null, venue?: string | null, start_date?: string | null, end_date?: string | null, date_range?: string | null, event_ids?: Array<string | null> | null, latitude_degrees?: number | null, longitude_degrees?: number | null, url?: string | null, competitor_limit?: number | null } | null> | null };

export type WcaSearchCompetitionsQueryVariables = Exact<{
  query: Scalars['String'];
}>;


export type WcaSearchCompetitionsQuery = { __typename?: 'Query', wcaSearchCompetitions?: Array<{ __typename?: 'WcaCompetition', id?: string | null, name?: string | null, city?: string | null, country_iso2?: string | null, start_date?: string | null, end_date?: string | null, url?: string | null } | null> | null };

export type MyWcaCompetitionsQueryVariables = Exact<{ [key: string]: never; }>;


export type MyWcaCompetitionsQuery = { __typename?: 'Query', myWcaCompetitions?: Array<{ __typename?: 'WcaCompetition', id?: string | null, name?: string | null, city?: string | null, country_iso2?: string | null, start_date?: string | null, end_date?: string | null, url?: string | null } | null> | null };

export type WcaCompetitionDetailQueryVariables = Exact<{
  input: WcaScheduleInput;
}>;


export type WcaCompetitionDetailQuery = { __typename?: 'Query', wcaCompetitionDetail?: { __typename?: 'WcaCompetitionDetail', competitionId?: string | null, competitionName?: string | null, myWcaId?: string | null, myRegistrationStatus?: string | null, myRegisteredEvents?: Array<string | null> | null, wcaLiveCompId?: string | null, competitors?: Array<{ __typename?: 'WcaCompetitor', name?: string | null, wcaId?: string | null, country?: string | null, avatar?: string | null, registrantId?: number | null, wcaUserId?: number | null, registeredEvents?: Array<string | null> | null, assignments?: Array<{ __typename?: 'WcaCompetitorAssignment', activityCode?: string | null, eventName?: string | null, roundNumber?: number | null, groupNumber?: number | null, assignmentCode?: string | null, startTime?: string | null, endTime?: string | null, stationNumber?: number | null, roomName?: string | null } | null> | null, personalBests?: Array<{ __typename?: 'WcaPersonalBest', eventId?: string | null, type?: string | null, best?: number | null, worldRanking?: number | null, continentalRanking?: number | null, nationalRanking?: number | null } | null> | null } | null> | null, events?: Array<{ __typename?: 'WcaEventDetail', eventId?: string | null, eventName?: string | null, rounds?: Array<{ __typename?: 'WcaRound', roundNumber?: number | null, format?: string | null, timeLimit?: number | null, cutoff?: number | null, cutoffAttempts?: number | null, advancementType?: string | null, advancementLevel?: number | null, groups?: Array<{ __typename?: 'WcaGroup', groupNumber?: number | null, activityCode?: string | null, startTime?: string | null, endTime?: string | null, competitors?: Array<{ __typename?: 'WcaGroupCompetitor', name?: string | null, wcaId?: string | null, registrantId?: number | null, assignmentCode?: string | null, seedResult?: number | null } | null> | null } | null> | null } | null> | null } | null> | null, schedule?: Array<{ __typename?: 'WcaScheduleDay', date?: string | null, assignments?: Array<{ __typename?: 'WcaScheduleAssignment', activityCode?: string | null, eventName?: string | null, roundNumber?: number | null, groupNumber?: number | null, assignmentCode?: string | null, startTime?: string | null, endTime?: string | null, roomName?: string | null, roomColor?: string | null, venueName?: string | null, stationNumber?: number | null } | null> | null } | null> | null, allPersonalBests?: Array<{ __typename?: 'WcaRankingRow', name?: string | null, wcaId?: string | null, registrantId?: number | null, eventId?: string | null, single?: number | null, average?: number | null, singleWorldRank?: number | null, averageWorldRank?: number | null } | null> | null, wcaLiveCompetitors?: Array<{ __typename?: 'WcaLiveCompetitor', wcaId?: string | null, liveId?: string | null } | null> | null, wcaLiveRoundMap?: Array<{ __typename?: 'WcaLiveRoundMapping', activityCode?: string | null, liveRoundId?: string | null } | null> | null, info?: { __typename?: 'WcaCompetitionInfo', wcaUrl?: string | null, venues?: Array<{ __typename?: 'WcaVenueInfo', name?: string | null, address?: string | null, city?: string | null } | null> | null, organizers?: Array<{ __typename?: 'WcaPersonInfo', name?: string | null, wcaId?: string | null, role?: string | null, avatar?: string | null } | null> | null, delegates?: Array<{ __typename?: 'WcaPersonInfo', name?: string | null, wcaId?: string | null, role?: string | null, avatar?: string | null } | null> | null } | null } | null };

export type WcaLiveCompetitionOverviewQueryVariables = Exact<{
  input: WcaLiveOverviewInput;
}>;


export type WcaLiveCompetitionOverviewQuery = { __typename?: 'Query', wcaLiveCompetitionOverview?: { __typename?: 'WcaLiveCompetitionOverview', compId?: string | null, name?: string | null, events?: Array<{ __typename?: 'WcaLiveEventInfo', eventId?: string | null, eventName?: string | null, rounds?: Array<{ __typename?: 'WcaLiveRoundInfo', liveRoundId?: string | null, number?: number | null, name?: string | null, open?: boolean | null, finished?: boolean | null, active?: boolean | null, numEntered?: number | null, numResults?: number | null, format?: { __typename?: 'WcaLiveFormat', numberOfAttempts?: number | null, sortBy?: string | null } | null, timeLimit?: { __typename?: 'WcaLiveTimeLimit', centiseconds?: number | null, cumulativeRoundWcifIds?: Array<string | null> | null } | null, cutoff?: { __typename?: 'WcaLiveCutoff', attemptResult?: number | null, numberOfAttempts?: number | null } | null, advancementCondition?: { __typename?: 'WcaLiveAdvancementCondition', type?: string | null, level?: number | null } | null } | null> | null } | null> | null, schedule?: Array<{ __typename?: 'WcaLiveScheduleVenue', name?: string | null, rooms?: Array<{ __typename?: 'WcaLiveScheduleRoom', name?: string | null, color?: string | null, activities?: Array<{ __typename?: 'WcaLiveScheduleActivity', activityId?: number | null, name?: string | null, activityCode?: string | null, startTime?: string | null, endTime?: string | null } | null> | null } | null> | null } | null> | null, records?: Array<{ __typename?: 'WcaLiveRecord', type?: string | null, tag?: string | null, eventId?: string | null, eventName?: string | null, attemptResult?: number | null, personName?: string | null, personCountryIso2?: string | null, roundNumber?: number | null } | null> | null, podiums?: Array<{ __typename?: 'WcaLivePodium', eventId?: string | null, eventName?: string | null, sortBy?: string | null, entries?: Array<{ __typename?: 'WcaLivePodiumEntry', ranking?: number | null, personName?: string | null, personCountryIso2?: string | null, best?: number | null, average?: number | null, singleRecordTag?: string | null, averageRecordTag?: string | null } | null> | null } | null> | null } | null };

export type WcaLiveRoundResultsQueryVariables = Exact<{
  input: WcaLiveRoundInput;
}>;


export type WcaLiveRoundResultsQuery = { __typename?: 'Query', wcaLiveRoundResults?: { __typename?: 'WcaLiveRoundResults', roundActivityCode?: string | null, roundName?: string | null, active?: boolean | null, finished?: boolean | null, numberOfAttempts?: number | null, sortBy?: string | null, results?: Array<{ __typename?: 'WcaLiveResult', ranking?: number | null, best?: number | null, average?: number | null, personName?: string | null, personWcaId?: string | null, personCountryIso2?: string | null, personLiveId?: string | null, singleRecordTag?: string | null, averageRecordTag?: string | null, advancing?: boolean | null, advancingQuestionable?: boolean | null, attempts?: Array<{ __typename?: 'WcaLiveAttempt', result?: number | null } | null> | null } | null> | null } | null };

export type WcaLiveCompetitorResultsQueryVariables = Exact<{
  input: WcaLiveCompetitorInput;
}>;


export type WcaLiveCompetitorResultsQuery = { __typename?: 'Query', wcaLiveCompetitorResults?: { __typename?: 'WcaLiveCompetitorResults', personName?: string | null, personWcaId?: string | null, personCountryIso2?: string | null, results?: Array<{ __typename?: 'WcaLiveCompetitorResultEntry', eventId?: string | null, eventName?: string | null, roundNumber?: number | null, roundName?: string | null, ranking?: number | null, best?: number | null, average?: number | null, singleRecordTag?: string | null, averageRecordTag?: string | null, advancing?: boolean | null, advancingQuestionable?: boolean | null, attempts?: Array<{ __typename?: 'WcaLiveAttempt', result?: number | null } | null> | null, format?: { __typename?: 'WcaLiveFormat', numberOfAttempts?: number | null, sortBy?: string | null } | null } | null> | null } | null };

export type AdminTrainerAlternativesQueryVariables = Exact<{
  category?: InputMaybe<Scalars['String']>;
  page?: InputMaybe<Scalars['Int']>;
  pageSize?: InputMaybe<Scalars['Int']>;
}>;


export type AdminTrainerAlternativesQuery = { __typename?: 'Query', adminTrainerAlternatives?: { __typename?: 'PaginatedTrainerAlternatives', total?: number | null, hasMore?: boolean | null, items?: Array<{ __typename?: 'TrainerAlternative', id?: string | null, category?: string | null, subset?: string | null, case_name?: string | null, algorithm?: string | null, original_input?: string | null, user_id?: string | null, created_at?: any | null } | null> | null } | null };

export const MiniSolveFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MiniSolveFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Solve"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"raw_time"}},{"kind":"Field","name":{"kind":"Name","value":"cube_type"}},{"kind":"Field","name":{"kind":"Name","value":"session_id"}},{"kind":"Field","name":{"kind":"Name","value":"trainer_name"}},{"kind":"Field","name":{"kind":"Name","value":"bulk"}},{"kind":"Field","name":{"kind":"Name","value":"scramble"}},{"kind":"Field","name":{"kind":"Name","value":"from_timer"}},{"kind":"Field","name":{"kind":"Name","value":"training_session_id"}},{"kind":"Field","name":{"kind":"Name","value":"dnf"}},{"kind":"Field","name":{"kind":"Name","value":"plus_two"}},{"kind":"Field","name":{"kind":"Name","value":"is_smart_cube"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"started_at"}},{"kind":"Field","name":{"kind":"Name","value":"ended_at"}}]}}]} as unknown as DocumentNode<MiniSolveFragmentFragment, unknown>;
export const StatsFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"StatsFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Stats"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"profile_views"}},{"kind":"Field","name":{"kind":"Name","value":"solve_views"}}]}}]} as unknown as DocumentNode<StatsFragmentFragment, unknown>;
export const StatsModuleBlockFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"StatsModuleBlockFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"StatsModuleBlock"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"statType"}},{"kind":"Field","name":{"kind":"Name","value":"sortBy"}},{"kind":"Field","name":{"kind":"Name","value":"session"}},{"kind":"Field","name":{"kind":"Name","value":"colorName"}},{"kind":"Field","name":{"kind":"Name","value":"averageCount"}}]}}]} as unknown as DocumentNode<StatsModuleBlockFragmentFragment, unknown>;
export const AlgorithmOverrideFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AlgorithmOverrideFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AlgorithmOverride"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cube_key"}},{"kind":"Field","name":{"kind":"Name","value":"rotate"}},{"kind":"Field","name":{"kind":"Name","value":"solution"}}]}}]} as unknown as DocumentNode<AlgorithmOverrideFragmentFragment, unknown>;
export const TrainerFavoriteFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TrainerFavoriteFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TrainerFavorite"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cube_key"}}]}}]} as unknown as DocumentNode<TrainerFavoriteFragmentFragment, unknown>;
export const TrainerAlgorithmFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TrainerAlgorithmFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TrainerAlgorithm"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"scrambles"}},{"kind":"Field","name":{"kind":"Name","value":"solution"}},{"kind":"Field","name":{"kind":"Name","value":"pro_only"}},{"kind":"Field","name":{"kind":"Name","value":"cube_type"}},{"kind":"Field","name":{"kind":"Name","value":"algo_type"}},{"kind":"Field","name":{"kind":"Name","value":"colors"}},{"kind":"Field","name":{"kind":"Name","value":"group_name"}}]}}]} as unknown as DocumentNode<TrainerAlgorithmFragmentFragment, unknown>;
export const SessionFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SessionFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Session"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"order"}}]}}]} as unknown as DocumentNode<SessionFragmentFragment, unknown>;
export const ImageFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ImageFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Image"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"user_id"}},{"kind":"Field","name":{"kind":"Name","value":"storage_path"}}]}}]} as unknown as DocumentNode<ImageFragmentFragment, unknown>;
export const PublicUserFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PublicUserFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"IPublicUserAccount"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"verified"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"banned_forever"}},{"kind":"Field","name":{"kind":"Name","value":"is_pro"}},{"kind":"Field","name":{"kind":"Name","value":"is_premium"}},{"kind":"Field","name":{"kind":"Name","value":"banned_until"}},{"kind":"Field","name":{"kind":"Name","value":"admin"}},{"kind":"Field","name":{"kind":"Name","value":"mod"}},{"kind":"Field","name":{"kind":"Name","value":"integrations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"service_name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"profile"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pfp_image"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ImageFragment"}}]}}]}}]}}]} as unknown as DocumentNode<PublicUserFragmentFragment, unknown>;
export const UserAccountFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UserAccountFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"IUserAccount"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserFragment"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"offline_hash"}}]}}]} as unknown as DocumentNode<UserAccountFragmentFragment, unknown>;
export const SolveFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SolveFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Solve"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"raw_time"}},{"kind":"Field","name":{"kind":"Name","value":"cube_type"}},{"kind":"Field","name":{"kind":"Name","value":"user_id"}},{"kind":"Field","name":{"kind":"Name","value":"scramble"}},{"kind":"Field","name":{"kind":"Name","value":"session_id"}},{"kind":"Field","name":{"kind":"Name","value":"started_at"}},{"kind":"Field","name":{"kind":"Name","value":"ended_at"}},{"kind":"Field","name":{"kind":"Name","value":"dnf"}},{"kind":"Field","name":{"kind":"Name","value":"plus_two"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"is_smart_cube"}},{"kind":"Field","name":{"kind":"Name","value":"smart_turn_count"}},{"kind":"Field","name":{"kind":"Name","value":"share_code"}},{"kind":"Field","name":{"kind":"Name","value":"smart_turns"}},{"kind":"Field","name":{"kind":"Name","value":"smart_put_down_time"}},{"kind":"Field","name":{"kind":"Name","value":"inspection_time"}},{"kind":"Field","name":{"kind":"Name","value":"smart_device"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"internal_name"}},{"kind":"Field","name":{"kind":"Name","value":"device_id"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solve_method_steps"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"turn_count"}},{"kind":"Field","name":{"kind":"Name","value":"turns"}},{"kind":"Field","name":{"kind":"Name","value":"total_time"}},{"kind":"Field","name":{"kind":"Name","value":"tps"}},{"kind":"Field","name":{"kind":"Name","value":"recognition_time"}},{"kind":"Field","name":{"kind":"Name","value":"oll_case_key"}},{"kind":"Field","name":{"kind":"Name","value":"pll_case_key"}},{"kind":"Field","name":{"kind":"Name","value":"skipped"}},{"kind":"Field","name":{"kind":"Name","value":"parent_name"}},{"kind":"Field","name":{"kind":"Name","value":"method_name"}},{"kind":"Field","name":{"kind":"Name","value":"step_index"}},{"kind":"Field","name":{"kind":"Name","value":"step_name"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}}]}}]} as unknown as DocumentNode<SolveFragmentFragment, unknown>;
export const PublicUserWithEloFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PublicUserWithEloFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"IPublicUserAccount"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserFragment"}}]}}]} as unknown as DocumentNode<PublicUserWithEloFragmentFragment, unknown>;
export const SolveWithUserFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SolveWithUserFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Solve"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SolveFragment"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserWithEloFragment"}}]}}]}}]} as unknown as DocumentNode<SolveWithUserFragmentFragment, unknown>;
export const NotificationFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"NotificationFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Notification"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"user_id"}},{"kind":"Field","name":{"kind":"Name","value":"notification_type"}},{"kind":"Field","name":{"kind":"Name","value":"notification_category_name"}},{"kind":"Field","name":{"kind":"Name","value":"triggering_user_id"}},{"kind":"Field","name":{"kind":"Name","value":"in_app_message"}},{"kind":"Field","name":{"kind":"Name","value":"read_at"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"icon"}},{"kind":"Field","name":{"kind":"Name","value":"link"}},{"kind":"Field","name":{"kind":"Name","value":"link_text"}},{"kind":"Field","name":{"kind":"Name","value":"subject"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"triggering_user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserWithEloFragment"}}]}}]}}]} as unknown as DocumentNode<NotificationFragmentFragment, unknown>;
export const TopSolveFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TopSolveFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TopSolve"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"cube_type"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"solve"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SolveFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserWithEloFragment"}}]}}]}}]} as unknown as DocumentNode<TopSolveFragmentFragment, unknown>;
export const TopAverageFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TopAverageFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TopAverage"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"cube_type"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"solve_1"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SolveFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solve_2"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SolveFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solve_3"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SolveFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solve_4"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SolveFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solve_5"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SolveFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserWithEloFragment"}}]}}]}}]} as unknown as DocumentNode<TopAverageFragmentFragment, unknown>;
export const ProfileFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ProfileFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Profile"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}},{"kind":"Field","name":{"kind":"Name","value":"three_method"}},{"kind":"Field","name":{"kind":"Name","value":"three_goal"}},{"kind":"Field","name":{"kind":"Name","value":"main_three_cube"}},{"kind":"Field","name":{"kind":"Name","value":"favorite_event"}},{"kind":"Field","name":{"kind":"Name","value":"youtube_link"}},{"kind":"Field","name":{"kind":"Name","value":"twitter_link"}},{"kind":"Field","name":{"kind":"Name","value":"user_id"}},{"kind":"Field","name":{"kind":"Name","value":"reddit_link"}},{"kind":"Field","name":{"kind":"Name","value":"twitch_link"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserWithEloFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"top_solves"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"TopSolveFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"top_averages"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"TopAverageFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"header_image"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ImageFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pfp_image"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ImageFragment"}}]}}]}}]} as unknown as DocumentNode<ProfileFragmentFragment, unknown>;
export const IntegrationFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"IntegrationFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Integration"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"auth_expires_at"}},{"kind":"Field","name":{"kind":"Name","value":"service_name"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}}]} as unknown as DocumentNode<IntegrationFragmentFragment, unknown>;
export const CustomTrainerFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"CustomTrainerFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"CustomTrainer"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"solution"}},{"kind":"Field","name":{"kind":"Name","value":"scrambles"}},{"kind":"Field","name":{"kind":"Name","value":"colors"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"alt_solutions"}},{"kind":"Field","name":{"kind":"Name","value":"group_name"}},{"kind":"Field","name":{"kind":"Name","value":"algo_type"}},{"kind":"Field","name":{"kind":"Name","value":"three_d"}},{"kind":"Field","name":{"kind":"Name","value":"cube_type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"copy_of_id"}},{"kind":"Field","name":{"kind":"Name","value":"copy_of"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}}]}}]}}]}}]} as unknown as DocumentNode<CustomTrainerFragmentFragment, unknown>;
export const PublicCustomTrainerRecordFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PublicCustomTrainerRecordFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"CustomTrainer"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"CustomTrainerFragment"}},{"kind":"Field","name":{"kind":"Name","value":"user_id"}},{"kind":"Field","name":{"kind":"Name","value":"like_count"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"profile"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pfp_image"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ImageFragment"}}]}}]}}]}}]}}]} as unknown as DocumentNode<PublicCustomTrainerRecordFragmentFragment, unknown>;
export const TimerBackgroundFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TimerBackgroundFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TimerBackground"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"hex"}},{"kind":"Field","name":{"kind":"Name","value":"storage_path"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"url"}}]}}]} as unknown as DocumentNode<TimerBackgroundFragmentFragment, unknown>;
export const UserForMeFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UserForMeFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"IUserAccount"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"join_country"}},{"kind":"Field","name":{"kind":"Name","value":"timer_background"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"TimerBackgroundFragment"}}]}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserWithEloFragment"}}]}}]} as unknown as DocumentNode<UserForMeFragmentFragment, unknown>;
export const ReportFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ReportFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Report"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"reported_user_id"}},{"kind":"Field","name":{"kind":"Name","value":"created_by_id"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"resolved_at"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"created_by"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserWithEloFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"reported_user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserWithEloFragment"}}]}}]}}]} as unknown as DocumentNode<ReportFragmentFragment, unknown>;
export const CustomCubeTypeFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"CustomCubeTypeFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"CustomCubeType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"user_id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"scramble"}},{"kind":"Field","name":{"kind":"Name","value":"private"}}]}}]} as unknown as DocumentNode<CustomCubeTypeFragmentFragment, unknown>;
export const SettingsFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SettingsFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Setting"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"user_id"}},{"kind":"Field","name":{"kind":"Name","value":"focus_mode"}},{"kind":"Field","name":{"kind":"Name","value":"freeze_time"}},{"kind":"Field","name":{"kind":"Name","value":"inspection"}},{"kind":"Field","name":{"kind":"Name","value":"manual_entry"}},{"kind":"Field","name":{"kind":"Name","value":"inspection_delay"}},{"kind":"Field","name":{"kind":"Name","value":"session_id"}},{"kind":"Field","name":{"kind":"Name","value":"inverse_time_list"}},{"kind":"Field","name":{"kind":"Name","value":"hide_time_when_solving"}},{"kind":"Field","name":{"kind":"Name","value":"nav_collapsed"}},{"kind":"Field","name":{"kind":"Name","value":"timer_decimal_points"}},{"kind":"Field","name":{"kind":"Name","value":"pb_confetti"}},{"kind":"Field","name":{"kind":"Name","value":"play_inspection_sound"}},{"kind":"Field","name":{"kind":"Name","value":"zero_out_time_after_solve"}},{"kind":"Field","name":{"kind":"Name","value":"confirm_delete_solve"}},{"kind":"Field","name":{"kind":"Name","value":"use_space_with_smart_cube"}},{"kind":"Field","name":{"kind":"Name","value":"use_2d_scramble_visual"}},{"kind":"Field","name":{"kind":"Name","value":"require_period_in_manual_time_entry"}},{"kind":"Field","name":{"kind":"Name","value":"cube_type"}},{"kind":"Field","name":{"kind":"Name","value":"custom_cube_types"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"CustomCubeTypeFragment"}}]}}]}}]} as unknown as DocumentNode<SettingsFragmentFragment, unknown>;
export const NotificationPreferenceFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"NotificationPreferenceFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NotificationPreference"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"marketing_emails"}}]}}]} as unknown as DocumentNode<NotificationPreferenceFragmentFragment, unknown>;
export const UserAccountSolvesSummaryFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UserAccountSolvesSummaryFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"UserAccountSolvesSummary"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"count"}},{"kind":"Field","name":{"kind":"Name","value":"average"}},{"kind":"Field","name":{"kind":"Name","value":"min_time"}},{"kind":"Field","name":{"kind":"Name","value":"max_time"}},{"kind":"Field","name":{"kind":"Name","value":"sum"}},{"kind":"Field","name":{"kind":"Name","value":"cube_type"}}]}}]} as unknown as DocumentNode<UserAccountSolvesSummaryFragmentFragment, unknown>;
export const UserAccountSummaryFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UserAccountSummaryFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"UserAccountSummary"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"solves"}},{"kind":"Field","name":{"kind":"Name","value":"reports_for"}},{"kind":"Field","name":{"kind":"Name","value":"reports_created"}},{"kind":"Field","name":{"kind":"Name","value":"profile_views"}},{"kind":"Field","name":{"kind":"Name","value":"bans"}},{"kind":"Field","name":{"kind":"Name","value":"timer_solves"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"UserAccountSolvesSummaryFragment"}}]}}]}}]} as unknown as DocumentNode<UserAccountSummaryFragmentFragment, unknown>;
export const UserForAdminFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UserForAdminFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"UserAccountForAdmin"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserWithEloFragment"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"join_country"}},{"kind":"Field","name":{"kind":"Name","value":"join_ip"}},{"kind":"Field","name":{"kind":"Name","value":"reports_for"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ReportFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"settings"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SettingsFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"notification_preferences"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"NotificationPreferenceFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"summary"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"UserAccountSummaryFragment"}}]}}]}}]} as unknown as DocumentNode<UserForAdminFragmentFragment, unknown>;
export const ReportSummaryFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ReportSummaryFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ReportSummary"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"last_report"}},{"kind":"Field","name":{"kind":"Name","value":"first_report"}},{"kind":"Field","name":{"kind":"Name","value":"count"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserWithEloFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"reports"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ReportFragment"}}]}}]}}]} as unknown as DocumentNode<ReportSummaryFragmentFragment, unknown>;
export const UpdateSiteConfigDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"updateSiteConfig"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateSiteConfigInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateSiteConfig"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"maintenance_mode"}},{"kind":"Field","name":{"kind":"Name","value":"trainer_enabled"}},{"kind":"Field","name":{"kind":"Name","value":"community_enabled"}},{"kind":"Field","name":{"kind":"Name","value":"leaderboards_enabled"}},{"kind":"Field","name":{"kind":"Name","value":"rooms_enabled"}},{"kind":"Field","name":{"kind":"Name","value":"battle_enabled"}},{"kind":"Field","name":{"kind":"Name","value":"updated_at"}}]}}]}}]} as unknown as DocumentNode<UpdateSiteConfigMutation, UpdateSiteConfigMutationVariables>;
export const MergeSessionsDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"mergeSessions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"oldSessionId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"newSessionId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mergeSessions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"oldSessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"oldSessionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"newSessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"newSessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SessionFragment"}}]}}]}},...SessionFragmentFragmentDoc.definitions]} as unknown as DocumentNode<MergeSessionsMutation, MergeSessionsMutationVariables>;
export const CreateSessionDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"createSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"SessionInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SessionFragment"}}]}}]}},...SessionFragmentFragmentDoc.definitions]} as unknown as DocumentNode<CreateSessionMutation, CreateSessionMutationVariables>;
export const UpdateSessionDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"updateSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"SessionInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SessionFragment"}}]}}]}},...SessionFragmentFragmentDoc.definitions]} as unknown as DocumentNode<UpdateSessionMutation, UpdateSessionMutationVariables>;
export const DeleteSessionDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"deleteSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SessionFragment"}}]}}]}},...SessionFragmentFragmentDoc.definitions]} as unknown as DocumentNode<DeleteSessionMutation, DeleteSessionMutationVariables>;
export const ReorderSessionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"reorderSessions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ids"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"reorderSessions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"ids"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ids"}}}]}]}}]} as unknown as DocumentNode<ReorderSessionsMutation, ReorderSessionsMutationVariables>;
export const CreateAnnouncementDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"createAnnouncement"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateAnnouncementInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createAnnouncement"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"isDraft"}}]}}]}}]} as unknown as DocumentNode<CreateAnnouncementMutation, CreateAnnouncementMutationVariables>;
export const UpdateAnnouncementDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"updateAnnouncement"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateAnnouncementInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateAnnouncement"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"isDraft"}}]}}]}}]} as unknown as DocumentNode<UpdateAnnouncementMutation, UpdateAnnouncementMutationVariables>;
export const MarkAnnouncementAsViewedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"markAnnouncementAsViewed"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"announcementId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"markAnnouncementAsViewed"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"announcementId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"announcementId"}}}]}]}}]} as unknown as DocumentNode<MarkAnnouncementAsViewedMutation, MarkAnnouncementAsViewedMutationVariables>;
export const DeleteAnnouncementDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"deleteAnnouncement"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteAnnouncement"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<DeleteAnnouncementMutation, DeleteAnnouncementMutationVariables>;
export const CreateTrainerAlternativeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"createTrainerAlternative"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"TrainerAlternativeCreateInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createTrainerAlternative"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"algorithm"}},{"kind":"Field","name":{"kind":"Name","value":"original_input"}},{"kind":"Field","name":{"kind":"Name","value":"setup"}},{"kind":"Field","name":{"kind":"Name","value":"ll_pattern"}}]}}]}}]} as unknown as DocumentNode<CreateTrainerAlternativeMutation, CreateTrainerAlternativeMutationVariables>;
export const AdminDeleteTrainerAlternativeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"adminDeleteTrainerAlternative"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"adminDeleteTrainerAlternative"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<AdminDeleteTrainerAlternativeMutation, AdminDeleteTrainerAlternativeMutationVariables>;
export const SiteConfigDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"siteConfig"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"siteConfig"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"maintenance_mode"}},{"kind":"Field","name":{"kind":"Name","value":"trainer_enabled"}},{"kind":"Field","name":{"kind":"Name","value":"community_enabled"}},{"kind":"Field","name":{"kind":"Name","value":"leaderboards_enabled"}},{"kind":"Field","name":{"kind":"Name","value":"rooms_enabled"}},{"kind":"Field","name":{"kind":"Name","value":"battle_enabled"}},{"kind":"Field","name":{"kind":"Name","value":"updated_at"}}]}}]}}]} as unknown as DocumentNode<SiteConfigQuery, SiteConfigQueryVariables>;
export const SolveByShareCodeDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"solveByShareCode"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"shareCode"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"solveByShareCode"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"shareCode"},"value":{"kind":"Variable","name":{"kind":"Name","value":"shareCode"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SolveWithUserFragment"}}]}}]}},...SolveWithUserFragmentFragmentDoc.definitions,...SolveFragmentFragmentDoc.definitions,...PublicUserWithEloFragmentFragmentDoc.definitions,...PublicUserFragmentFragmentDoc.definitions,...ImageFragmentFragmentDoc.definitions]} as unknown as DocumentNode<SolveByShareCodeQuery, SolveByShareCodeQueryVariables>;
export const ProfileDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"profile"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"username"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"profile"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"username"},"value":{"kind":"Variable","name":{"kind":"Name","value":"username"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ProfileFragment"}}]}}]}},...ProfileFragmentFragmentDoc.definitions,...PublicUserWithEloFragmentFragmentDoc.definitions,...PublicUserFragmentFragmentDoc.definitions,...ImageFragmentFragmentDoc.definitions,...TopSolveFragmentFragmentDoc.definitions,...SolveFragmentFragmentDoc.definitions,...TopAverageFragmentFragmentDoc.definitions]} as unknown as DocumentNode<ProfileQuery, ProfileQueryVariables>;
export const UserSearchDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"userSearch"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pageArgs"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"PaginationArgsInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userSearch"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"pageArgs"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pageArgs"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasMore"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserFragment"}}]}}]}}]}},...PublicUserFragmentFragmentDoc.definitions,...ImageFragmentFragmentDoc.definitions]} as unknown as DocumentNode<UserSearchQuery, UserSearchQueryVariables>;
export const AdminUserSearchDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"adminUserSearch"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pageArgs"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"PaginationArgsInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"adminUserSearch"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"pageArgs"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pageArgs"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasMore"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"UserAccountFragment"}}]}}]}}]}},...UserAccountFragmentFragmentDoc.definitions,...PublicUserFragmentFragmentDoc.definitions,...ImageFragmentFragmentDoc.definitions]} as unknown as DocumentNode<AdminUserSearchQuery, AdminUserSearchQueryVariables>;
export const GetActiveAnnouncementsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"getActiveAnnouncements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getActiveAnnouncements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"hasViewed"}}]}}]}}]} as unknown as DocumentNode<GetActiveAnnouncementsQuery, GetActiveAnnouncementsQueryVariables>;
export const GetUnreadAnnouncementCountDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"getUnreadAnnouncementCount"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getUnreadAnnouncementCount"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"count"}}]}}]}}]} as unknown as DocumentNode<GetUnreadAnnouncementCountQuery, GetUnreadAnnouncementCountQueryVariables>;
export const GetAllAnnouncementsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"getAllAnnouncements"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"AnnouncementFilterInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getAllAnnouncements"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"isDraft"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"viewCount"}}]}}]}}]} as unknown as DocumentNode<GetAllAnnouncementsQuery, GetAllAnnouncementsQueryVariables>;
export const GetMyAnnouncementHistoryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"getMyAnnouncementHistory"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"offset"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getMyAnnouncementHistory"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}},{"kind":"Argument","name":{"kind":"Name","value":"offset"},"value":{"kind":"Variable","name":{"kind":"Name","value":"offset"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<GetMyAnnouncementHistoryQuery, GetMyAnnouncementHistoryQueryVariables>;
export const TrainerAlternativesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"trainerAlternatives"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"category"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"caseName"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"trainerAlternatives"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"category"},"value":{"kind":"Variable","name":{"kind":"Name","value":"category"}}},{"kind":"Argument","name":{"kind":"Name","value":"caseName"},"value":{"kind":"Variable","name":{"kind":"Name","value":"caseName"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"algorithm"}},{"kind":"Field","name":{"kind":"Name","value":"original_input"}},{"kind":"Field","name":{"kind":"Name","value":"setup"}},{"kind":"Field","name":{"kind":"Name","value":"ll_pattern"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}}]}}]} as unknown as DocumentNode<TrainerAlternativesQuery, TrainerAlternativesQueryVariables>;
export const WcaCompetitionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"wcaCompetitions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"WcaCompetitionFilterInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"wcaCompetitions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"city"}},{"kind":"Field","name":{"kind":"Name","value":"country_iso2"}},{"kind":"Field","name":{"kind":"Name","value":"venue"}},{"kind":"Field","name":{"kind":"Name","value":"start_date"}},{"kind":"Field","name":{"kind":"Name","value":"end_date"}},{"kind":"Field","name":{"kind":"Name","value":"date_range"}},{"kind":"Field","name":{"kind":"Name","value":"event_ids"}},{"kind":"Field","name":{"kind":"Name","value":"latitude_degrees"}},{"kind":"Field","name":{"kind":"Name","value":"longitude_degrees"}},{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"competitor_limit"}}]}}]}}]} as unknown as DocumentNode<WcaCompetitionsQuery, WcaCompetitionsQueryVariables>;
export const WcaSearchCompetitionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"wcaSearchCompetitions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"query"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"wcaSearchCompetitions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"query"},"value":{"kind":"Variable","name":{"kind":"Name","value":"query"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"city"}},{"kind":"Field","name":{"kind":"Name","value":"country_iso2"}},{"kind":"Field","name":{"kind":"Name","value":"start_date"}},{"kind":"Field","name":{"kind":"Name","value":"end_date"}},{"kind":"Field","name":{"kind":"Name","value":"url"}}]}}]}}]} as unknown as DocumentNode<WcaSearchCompetitionsQuery, WcaSearchCompetitionsQueryVariables>;
export const MyWcaCompetitionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"myWcaCompetitions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"myWcaCompetitions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"city"}},{"kind":"Field","name":{"kind":"Name","value":"country_iso2"}},{"kind":"Field","name":{"kind":"Name","value":"start_date"}},{"kind":"Field","name":{"kind":"Name","value":"end_date"}},{"kind":"Field","name":{"kind":"Name","value":"url"}}]}}]}}]} as unknown as DocumentNode<MyWcaCompetitionsQuery, MyWcaCompetitionsQueryVariables>;
export const WcaCompetitionDetailDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"wcaCompetitionDetail"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"WcaScheduleInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"wcaCompetitionDetail"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"competitionId"}},{"kind":"Field","name":{"kind":"Name","value":"competitionName"}},{"kind":"Field","name":{"kind":"Name","value":"myWcaId"}},{"kind":"Field","name":{"kind":"Name","value":"myRegistrationStatus"}},{"kind":"Field","name":{"kind":"Name","value":"myRegisteredEvents"}},{"kind":"Field","name":{"kind":"Name","value":"competitors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"wcaId"}},{"kind":"Field","name":{"kind":"Name","value":"country"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"registrantId"}},{"kind":"Field","name":{"kind":"Name","value":"wcaUserId"}},{"kind":"Field","name":{"kind":"Name","value":"registeredEvents"}},{"kind":"Field","name":{"kind":"Name","value":"assignments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"activityCode"}},{"kind":"Field","name":{"kind":"Name","value":"eventName"}},{"kind":"Field","name":{"kind":"Name","value":"roundNumber"}},{"kind":"Field","name":{"kind":"Name","value":"groupNumber"}},{"kind":"Field","name":{"kind":"Name","value":"assignmentCode"}},{"kind":"Field","name":{"kind":"Name","value":"startTime"}},{"kind":"Field","name":{"kind":"Name","value":"endTime"}},{"kind":"Field","name":{"kind":"Name","value":"stationNumber"}},{"kind":"Field","name":{"kind":"Name","value":"roomName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBests"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"eventId"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"best"}},{"kind":"Field","name":{"kind":"Name","value":"worldRanking"}},{"kind":"Field","name":{"kind":"Name","value":"continentalRanking"}},{"kind":"Field","name":{"kind":"Name","value":"nationalRanking"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"events"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"eventId"}},{"kind":"Field","name":{"kind":"Name","value":"eventName"}},{"kind":"Field","name":{"kind":"Name","value":"rounds"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"roundNumber"}},{"kind":"Field","name":{"kind":"Name","value":"format"}},{"kind":"Field","name":{"kind":"Name","value":"timeLimit"}},{"kind":"Field","name":{"kind":"Name","value":"cutoff"}},{"kind":"Field","name":{"kind":"Name","value":"cutoffAttempts"}},{"kind":"Field","name":{"kind":"Name","value":"advancementType"}},{"kind":"Field","name":{"kind":"Name","value":"advancementLevel"}},{"kind":"Field","name":{"kind":"Name","value":"groups"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"groupNumber"}},{"kind":"Field","name":{"kind":"Name","value":"activityCode"}},{"kind":"Field","name":{"kind":"Name","value":"startTime"}},{"kind":"Field","name":{"kind":"Name","value":"endTime"}},{"kind":"Field","name":{"kind":"Name","value":"competitors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"wcaId"}},{"kind":"Field","name":{"kind":"Name","value":"registrantId"}},{"kind":"Field","name":{"kind":"Name","value":"assignmentCode"}},{"kind":"Field","name":{"kind":"Name","value":"seedResult"}}]}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"schedule"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"assignments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"activityCode"}},{"kind":"Field","name":{"kind":"Name","value":"eventName"}},{"kind":"Field","name":{"kind":"Name","value":"roundNumber"}},{"kind":"Field","name":{"kind":"Name","value":"groupNumber"}},{"kind":"Field","name":{"kind":"Name","value":"assignmentCode"}},{"kind":"Field","name":{"kind":"Name","value":"startTime"}},{"kind":"Field","name":{"kind":"Name","value":"endTime"}},{"kind":"Field","name":{"kind":"Name","value":"roomName"}},{"kind":"Field","name":{"kind":"Name","value":"roomColor"}},{"kind":"Field","name":{"kind":"Name","value":"venueName"}},{"kind":"Field","name":{"kind":"Name","value":"stationNumber"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"allPersonalBests"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"wcaId"}},{"kind":"Field","name":{"kind":"Name","value":"registrantId"}},{"kind":"Field","name":{"kind":"Name","value":"eventId"}},{"kind":"Field","name":{"kind":"Name","value":"single"}},{"kind":"Field","name":{"kind":"Name","value":"average"}},{"kind":"Field","name":{"kind":"Name","value":"singleWorldRank"}},{"kind":"Field","name":{"kind":"Name","value":"averageWorldRank"}}]}},{"kind":"Field","name":{"kind":"Name","value":"wcaLiveCompId"}},{"kind":"Field","name":{"kind":"Name","value":"wcaLiveCompetitors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"wcaId"}},{"kind":"Field","name":{"kind":"Name","value":"liveId"}}]}},{"kind":"Field","name":{"kind":"Name","value":"wcaLiveRoundMap"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"activityCode"}},{"kind":"Field","name":{"kind":"Name","value":"liveRoundId"}}]}},{"kind":"Field","name":{"kind":"Name","value":"info"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"venues"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"address"}},{"kind":"Field","name":{"kind":"Name","value":"city"}}]}},{"kind":"Field","name":{"kind":"Name","value":"organizers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"wcaId"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}},{"kind":"Field","name":{"kind":"Name","value":"delegates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"wcaId"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}},{"kind":"Field","name":{"kind":"Name","value":"wcaUrl"}}]}}]}}]}}]} as unknown as DocumentNode<WcaCompetitionDetailQuery, WcaCompetitionDetailQueryVariables>;
export const WcaLiveCompetitionOverviewDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"wcaLiveCompetitionOverview"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"WcaLiveOverviewInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"wcaLiveCompetitionOverview"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"compId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"events"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"eventId"}},{"kind":"Field","name":{"kind":"Name","value":"eventName"}},{"kind":"Field","name":{"kind":"Name","value":"rounds"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"liveRoundId"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"open"}},{"kind":"Field","name":{"kind":"Name","value":"finished"}},{"kind":"Field","name":{"kind":"Name","value":"active"}},{"kind":"Field","name":{"kind":"Name","value":"numEntered"}},{"kind":"Field","name":{"kind":"Name","value":"numResults"}},{"kind":"Field","name":{"kind":"Name","value":"format"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"numberOfAttempts"}},{"kind":"Field","name":{"kind":"Name","value":"sortBy"}}]}},{"kind":"Field","name":{"kind":"Name","value":"timeLimit"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"centiseconds"}},{"kind":"Field","name":{"kind":"Name","value":"cumulativeRoundWcifIds"}}]}},{"kind":"Field","name":{"kind":"Name","value":"cutoff"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"attemptResult"}},{"kind":"Field","name":{"kind":"Name","value":"numberOfAttempts"}}]}},{"kind":"Field","name":{"kind":"Name","value":"advancementCondition"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"level"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"schedule"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"rooms"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"color"}},{"kind":"Field","name":{"kind":"Name","value":"activities"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"activityId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"activityCode"}},{"kind":"Field","name":{"kind":"Name","value":"startTime"}},{"kind":"Field","name":{"kind":"Name","value":"endTime"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"records"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"tag"}},{"kind":"Field","name":{"kind":"Name","value":"eventId"}},{"kind":"Field","name":{"kind":"Name","value":"eventName"}},{"kind":"Field","name":{"kind":"Name","value":"attemptResult"}},{"kind":"Field","name":{"kind":"Name","value":"personName"}},{"kind":"Field","name":{"kind":"Name","value":"personCountryIso2"}},{"kind":"Field","name":{"kind":"Name","value":"roundNumber"}}]}},{"kind":"Field","name":{"kind":"Name","value":"podiums"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"eventId"}},{"kind":"Field","name":{"kind":"Name","value":"eventName"}},{"kind":"Field","name":{"kind":"Name","value":"sortBy"}},{"kind":"Field","name":{"kind":"Name","value":"entries"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ranking"}},{"kind":"Field","name":{"kind":"Name","value":"personName"}},{"kind":"Field","name":{"kind":"Name","value":"personCountryIso2"}},{"kind":"Field","name":{"kind":"Name","value":"best"}},{"kind":"Field","name":{"kind":"Name","value":"average"}},{"kind":"Field","name":{"kind":"Name","value":"singleRecordTag"}},{"kind":"Field","name":{"kind":"Name","value":"averageRecordTag"}}]}}]}}]}}]}}]} as unknown as DocumentNode<WcaLiveCompetitionOverviewQuery, WcaLiveCompetitionOverviewQueryVariables>;
export const WcaLiveRoundResultsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"wcaLiveRoundResults"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"WcaLiveRoundInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"wcaLiveRoundResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"roundActivityCode"}},{"kind":"Field","name":{"kind":"Name","value":"roundName"}},{"kind":"Field","name":{"kind":"Name","value":"active"}},{"kind":"Field","name":{"kind":"Name","value":"finished"}},{"kind":"Field","name":{"kind":"Name","value":"numberOfAttempts"}},{"kind":"Field","name":{"kind":"Name","value":"sortBy"}},{"kind":"Field","name":{"kind":"Name","value":"results"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ranking"}},{"kind":"Field","name":{"kind":"Name","value":"best"}},{"kind":"Field","name":{"kind":"Name","value":"average"}},{"kind":"Field","name":{"kind":"Name","value":"attempts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"result"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personName"}},{"kind":"Field","name":{"kind":"Name","value":"personWcaId"}},{"kind":"Field","name":{"kind":"Name","value":"personCountryIso2"}},{"kind":"Field","name":{"kind":"Name","value":"personLiveId"}},{"kind":"Field","name":{"kind":"Name","value":"singleRecordTag"}},{"kind":"Field","name":{"kind":"Name","value":"averageRecordTag"}},{"kind":"Field","name":{"kind":"Name","value":"advancing"}},{"kind":"Field","name":{"kind":"Name","value":"advancingQuestionable"}}]}}]}}]}}]} as unknown as DocumentNode<WcaLiveRoundResultsQuery, WcaLiveRoundResultsQueryVariables>;
export const WcaLiveCompetitorResultsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"wcaLiveCompetitorResults"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"WcaLiveCompetitorInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"wcaLiveCompetitorResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"personName"}},{"kind":"Field","name":{"kind":"Name","value":"personWcaId"}},{"kind":"Field","name":{"kind":"Name","value":"personCountryIso2"}},{"kind":"Field","name":{"kind":"Name","value":"results"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"eventId"}},{"kind":"Field","name":{"kind":"Name","value":"eventName"}},{"kind":"Field","name":{"kind":"Name","value":"roundNumber"}},{"kind":"Field","name":{"kind":"Name","value":"roundName"}},{"kind":"Field","name":{"kind":"Name","value":"ranking"}},{"kind":"Field","name":{"kind":"Name","value":"best"}},{"kind":"Field","name":{"kind":"Name","value":"average"}},{"kind":"Field","name":{"kind":"Name","value":"attempts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"result"}}]}},{"kind":"Field","name":{"kind":"Name","value":"singleRecordTag"}},{"kind":"Field","name":{"kind":"Name","value":"averageRecordTag"}},{"kind":"Field","name":{"kind":"Name","value":"advancing"}},{"kind":"Field","name":{"kind":"Name","value":"advancingQuestionable"}},{"kind":"Field","name":{"kind":"Name","value":"format"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"numberOfAttempts"}},{"kind":"Field","name":{"kind":"Name","value":"sortBy"}}]}}]}}]}}]}}]} as unknown as DocumentNode<WcaLiveCompetitorResultsQuery, WcaLiveCompetitorResultsQueryVariables>;
export const AdminTrainerAlternativesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"adminTrainerAlternatives"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"category"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"page"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pageSize"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"adminTrainerAlternatives"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"category"},"value":{"kind":"Variable","name":{"kind":"Name","value":"category"}}},{"kind":"Argument","name":{"kind":"Name","value":"page"},"value":{"kind":"Variable","name":{"kind":"Name","value":"page"}}},{"kind":"Argument","name":{"kind":"Name","value":"pageSize"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pageSize"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"subset"}},{"kind":"Field","name":{"kind":"Name","value":"case_name"}},{"kind":"Field","name":{"kind":"Name","value":"algorithm"}},{"kind":"Field","name":{"kind":"Name","value":"original_input"}},{"kind":"Field","name":{"kind":"Name","value":"user_id"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"hasMore"}}]}}]}}]} as unknown as DocumentNode<AdminTrainerAlternativesQuery, AdminTrainerAlternativesQueryVariables>;