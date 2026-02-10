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

export type ChatMessage = {
  __typename?: 'ChatMessage';
  created_at?: Maybe<Scalars['DateTime']>;
  id?: Maybe<Scalars['String']>;
  match_session?: Maybe<MatchSession>;
  match_session_id?: Maybe<Scalars['String']>;
  message?: Maybe<Scalars['String']>;
  user?: Maybe<PublicUserAccount>;
  user_id?: Maybe<Scalars['String']>;
};

export type CreateAnnouncementInput = {
  category?: InputMaybe<Scalars['String']>;
  content?: InputMaybe<Scalars['String']>;
  imageUrl?: InputMaybe<Scalars['String']>;
  isDraft?: InputMaybe<Scalars['Boolean']>;
  priority?: InputMaybe<Scalars['Int']>;
  title?: InputMaybe<Scalars['String']>;
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

export type EloLog = {
  __typename?: 'EloLog';
  created_at?: Maybe<Scalars['DateTime']>;
  cube_type?: Maybe<Scalars['String']>;
  elo_change?: Maybe<Scalars['Float']>;
  id?: Maybe<Scalars['String']>;
  match?: Maybe<Match>;
  match_id?: Maybe<Scalars['String']>;
  opponent?: Maybe<PublicUserAccount>;
  opponent_id?: Maybe<Scalars['String']>;
  opponent_new_elo_rating?: Maybe<Scalars['Float']>;
  opponent_new_game_count?: Maybe<Scalars['String']>;
  player?: Maybe<PublicUserAccount>;
  player_id?: Maybe<Scalars['String']>;
  player_new_elo_rating?: Maybe<Scalars['Float']>;
  player_new_game_count?: Maybe<Scalars['String']>;
  updated_at?: Maybe<Scalars['DateTime']>;
};

export type EloRating = {
  __typename?: 'EloRating';
  created_at?: Maybe<Scalars['DateTime']>;
  elo_222_rating?: Maybe<Scalars['Float']>;
  elo_333_rating?: Maybe<Scalars['Float']>;
  elo_444_rating?: Maybe<Scalars['Float']>;
  elo_overall_rating?: Maybe<Scalars['Float']>;
  games_222_count?: Maybe<Scalars['Float']>;
  games_333_count?: Maybe<Scalars['Float']>;
  games_444_count?: Maybe<Scalars['Float']>;
  games_overall_count?: Maybe<Scalars['Float']>;
  id?: Maybe<Scalars['String']>;
  profile?: Maybe<Profile>;
  profile_id?: Maybe<Scalars['String']>;
  updated_at?: Maybe<Scalars['DateTime']>;
  user?: Maybe<PublicUserAccount>;
  user_id?: Maybe<Scalars['String']>;
};

export type File = {
  __typename?: 'File';
  encoding: Scalars['String'];
  filename: Scalars['String'];
  mimetype: Scalars['String'];
};

export type Friendship = {
  __typename?: 'Friendship';
  created_at?: Maybe<Scalars['DateTime']>;
  friendship_request?: Maybe<FriendshipRequest>;
  friendship_request_id?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  other_user?: Maybe<PublicUserAccount>;
  other_user_id?: Maybe<Scalars['String']>;
  user?: Maybe<PublicUserAccount>;
  user_id?: Maybe<Scalars['String']>;
};

export type FriendshipRequest = {
  __typename?: 'FriendshipRequest';
  accepted?: Maybe<Scalars['Boolean']>;
  created_at?: Maybe<Scalars['DateTime']>;
  from_id?: Maybe<Scalars['String']>;
  from_user?: Maybe<PublicUserAccount>;
  id?: Maybe<Scalars['String']>;
  to_id?: Maybe<Scalars['String']>;
  to_user?: Maybe<PublicUserAccount>;
};

export type FriendshipRequestResult = {
  __typename?: 'FriendshipRequestResult';
  more_results?: Maybe<Scalars['Boolean']>;
  records?: Maybe<Array<Maybe<FriendshipRequest>>>;
  total_count?: Maybe<Scalars['Int']>;
};

export type FriendshipResult = {
  __typename?: 'FriendshipResult';
  id?: Maybe<Scalars['String']>;
  more_results?: Maybe<Scalars['Boolean']>;
  records?: Maybe<Array<Maybe<Friendship>>>;
};

export type FriendshipStats = {
  __typename?: 'FriendshipStats';
  friend_count?: Maybe<Scalars['Int']>;
  friend_requests_count?: Maybe<Scalars['Int']>;
  friend_requests_sent_count?: Maybe<Scalars['Int']>;
};

export type GameOptions = {
  __typename?: 'GameOptions';
  cube_type?: Maybe<Scalars['String']>;
  elimination_percent_change_rate?: Maybe<Scalars['Float']>;
  elimination_starting_time_seconds?: Maybe<Scalars['Float']>;
  game_session_id?: Maybe<Scalars['String']>;
  game_type?: Maybe<GameType>;
  gauntlet_time_multiplier?: Maybe<Scalars['Float']>;
  head_to_head_target_win_count?: Maybe<Scalars['Float']>;
  id?: Maybe<Scalars['String']>;
  match_session_id?: Maybe<Scalars['String']>;
};

export type GameOptionsInput = {
  cube_type?: InputMaybe<Scalars['String']>;
  elimination_percent_change_rate?: InputMaybe<Scalars['Float']>;
  elimination_starting_time_seconds?: InputMaybe<Scalars['Float']>;
  game_type?: InputMaybe<GameType>;
  gauntlet_time_multiplier?: InputMaybe<Scalars['Float']>;
  head_to_head_target_win_count?: InputMaybe<Scalars['Float']>;
};

export type GameSession = {
  __typename?: 'GameSession';
  created_at?: Maybe<Scalars['DateTime']>;
  game_type?: Maybe<GameType>;
  id?: Maybe<Scalars['String']>;
  match?: Maybe<Match>;
  match_id?: Maybe<Scalars['String']>;
  solve_count?: Maybe<Scalars['Int']>;
  solves?: Maybe<Array<Maybe<Solve>>>;
  total_time?: Maybe<Scalars['Float']>;
  user?: Maybe<PublicUserAccount>;
  user_id?: Maybe<Scalars['String']>;
};

export enum GameType {
  Elimination = 'ELIMINATION',
  HeadToHead = 'HEAD_TO_HEAD'
}

export type IInternalUserAccount = {
  admin?: Maybe<Scalars['Boolean']>;
  badges?: Maybe<Array<Maybe<Badge>>>;
  banned_forever?: Maybe<Scalars['Boolean']>;
  banned_until?: Maybe<Scalars['DateTime']>;
  bans?: Maybe<Array<Maybe<BanLog>>>;
  chat_messages?: Maybe<Array<Maybe<ChatMessage>>>;
  created_at?: Maybe<Scalars['DateTime']>;
  elo_rating?: Maybe<EloRating>;
  email?: Maybe<Scalars['String']>;
  first_name?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  integrations?: Maybe<Array<Maybe<Integration>>>;
  is_pro?: Maybe<Scalars['Boolean']>;
  join_country?: Maybe<Scalars['String']>;
  join_ip?: Maybe<Scalars['String']>;
  last_name?: Maybe<Scalars['String']>;
  last_solve_at?: Maybe<Scalars['DateTime']>;
  mod?: Maybe<Scalars['Boolean']>;
  notification_preferences?: Maybe<NotificationPreference>;
  offline_hash?: Maybe<Scalars['String']>;
  password?: Maybe<Scalars['String']>;
  pro_status?: Maybe<SubscriptionStatus>;
  profile?: Maybe<Profile>;
  reports_for?: Maybe<Array<Maybe<Report>>>;
  settings?: Maybe<Setting>;
  stripe_customer_id?: Maybe<Scalars['String']>;
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
  wca_id?: Maybe<Scalars['String']>;
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
  chat_messages?: Maybe<Array<Maybe<ChatMessage>>>;
  created_at?: Maybe<Scalars['DateTime']>;
  elo_rating?: Maybe<EloRating>;
  email?: Maybe<Scalars['String']>;
  first_name?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  integrations?: Maybe<Array<Maybe<Integration>>>;
  is_pro?: Maybe<Scalars['Boolean']>;
  join_country?: Maybe<Scalars['String']>;
  join_ip?: Maybe<Scalars['String']>;
  last_name?: Maybe<Scalars['String']>;
  last_solve_at?: Maybe<Scalars['DateTime']>;
  mod?: Maybe<Scalars['Boolean']>;
  notification_preferences?: Maybe<NotificationPreference>;
  offline_hash?: Maybe<Scalars['String']>;
  password?: Maybe<Scalars['String']>;
  pro_status?: Maybe<SubscriptionStatus>;
  profile?: Maybe<Profile>;
  reports_for?: Maybe<Array<Maybe<Report>>>;
  settings?: Maybe<Setting>;
  stripe_customer_id?: Maybe<Scalars['String']>;
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
  elo_rating?: Maybe<EloRating>;
  id?: Maybe<Scalars['String']>;
  integrations?: Maybe<Array<Maybe<Integration>>>;
  is_pro?: Maybe<Scalars['Boolean']>;
  last_solve_at?: Maybe<Scalars['DateTime']>;
  mod?: Maybe<Scalars['Boolean']>;
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
  elo_rating?: Maybe<EloRating>;
  email?: Maybe<Scalars['String']>;
  first_name?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  integrations?: Maybe<Array<Maybe<Integration>>>;
  is_pro?: Maybe<Scalars['Boolean']>;
  join_country?: Maybe<Scalars['String']>;
  last_name?: Maybe<Scalars['String']>;
  last_solve_at?: Maybe<Scalars['DateTime']>;
  mod?: Maybe<Scalars['Boolean']>;
  offline_hash?: Maybe<Scalars['String']>;
  pro_status?: Maybe<SubscriptionStatus>;
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
  chat_messages?: Maybe<Array<Maybe<ChatMessage>>>;
  created_at?: Maybe<Scalars['DateTime']>;
  elo_rating?: Maybe<EloRating>;
  email?: Maybe<Scalars['String']>;
  first_name?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  integrations?: Maybe<Array<Maybe<Integration>>>;
  is_pro?: Maybe<Scalars['Boolean']>;
  join_country?: Maybe<Scalars['String']>;
  join_ip?: Maybe<Scalars['String']>;
  last_name?: Maybe<Scalars['String']>;
  last_solve_at?: Maybe<Scalars['DateTime']>;
  mod?: Maybe<Scalars['Boolean']>;
  notification_preferences?: Maybe<NotificationPreference>;
  offline_hash?: Maybe<Scalars['String']>;
  pro_status?: Maybe<SubscriptionStatus>;
  profile?: Maybe<Profile>;
  reports_for?: Maybe<Array<Maybe<Report>>>;
  settings?: Maybe<Setting>;
  summary?: Maybe<UserAccountSummary>;
  timer_background?: Maybe<TimerBackground>;
  top_averages?: Maybe<Array<Maybe<TopAverage>>>;
  top_solves?: Maybe<Array<Maybe<TopSolve>>>;
  username?: Maybe<Scalars['String']>;
  verified?: Maybe<Scalars['Boolean']>;
};

export type Match = {
  __typename?: 'Match';
  aborted?: Maybe<Scalars['Boolean']>;
  created_at?: Maybe<Scalars['DateTime']>;
  elo_log?: Maybe<Array<Maybe<EloLog>>>;
  ended_at?: Maybe<Scalars['DateTime']>;
  id?: Maybe<Scalars['String']>;
  link_code?: Maybe<Scalars['String']>;
  match_session?: Maybe<MatchSession>;
  match_session_id?: Maybe<Scalars['String']>;
  participants?: Maybe<Array<Maybe<MatchParticipant>>>;
  spectate_code?: Maybe<Scalars['String']>;
  started_at?: Maybe<Scalars['DateTime']>;
  winner?: Maybe<PublicUserAccount>;
  winner_id?: Maybe<Scalars['String']>;
};

export type MatchParticipant = {
  __typename?: 'MatchParticipant';
  created_at?: Maybe<Scalars['DateTime']>;
  forfeited?: Maybe<Scalars['Boolean']>;
  id?: Maybe<Scalars['String']>;
  lost?: Maybe<Scalars['Boolean']>;
  match?: Maybe<Match>;
  match_id?: Maybe<Scalars['String']>;
  position?: Maybe<Scalars['Int']>;
  resigned?: Maybe<Scalars['Boolean']>;
  solves?: Maybe<Array<Maybe<Solve>>>;
  user?: Maybe<PublicUserAccount>;
  user_id?: Maybe<Scalars['String']>;
  won?: Maybe<Scalars['Boolean']>;
};

export type MatchSession = {
  __typename?: 'MatchSession';
  chat_messages?: Maybe<Array<Maybe<ChatMessage>>>;
  created_at?: Maybe<Scalars['DateTime']>;
  created_by?: Maybe<PublicUserAccount>;
  created_by_id?: Maybe<Scalars['String']>;
  custom_match?: Maybe<Scalars['Boolean']>;
  game_options?: Maybe<GameOptions>;
  id?: Maybe<Scalars['String']>;
  match_type?: Maybe<Scalars['String']>;
  max_players?: Maybe<Scalars['Int']>;
  min_players?: Maybe<Scalars['Int']>;
  participants?: Maybe<Array<Maybe<MatchParticipant>>>;
  rated?: Maybe<Scalars['Boolean']>;
  winner?: Maybe<PublicUserAccount>;
};

export type MatchSessionInput = {
  cube_type?: InputMaybe<Scalars['String']>;
  head_to_head_target_win_count?: InputMaybe<Scalars['Float']>;
  match_type?: InputMaybe<GameType>;
  max_players?: InputMaybe<Scalars['Int']>;
  min_players?: InputMaybe<Scalars['Int']>;
};

export type Membership = {
  __typename?: 'Membership';
  cancel_at_period_end?: Maybe<Scalars['Boolean']>;
  canceled_at?: Maybe<Scalars['Float']>;
  current_period_end?: Maybe<Scalars['Float']>;
  days_until_due?: Maybe<Scalars['Float']>;
  ended_at?: Maybe<Scalars['Float']>;
  pricing?: Maybe<MembershipPricing>;
  start_date?: Maybe<Scalars['Float']>;
  status?: Maybe<SubscriptionStatus>;
};

export type MembershipOptions = {
  __typename?: 'MembershipOptions';
  month?: Maybe<MembershipPricing>;
  year?: Maybe<MembershipPricing>;
};

export type MembershipPricing = {
  __typename?: 'MembershipPricing';
  currency?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  interval?: Maybe<Scalars['String']>;
  interval_count?: Maybe<Scalars['Float']>;
  unit_amount?: Maybe<Scalars['Float']>;
};

export type Mutation = {
  __typename?: 'Mutation';
  acceptFriendshipRequest?: Maybe<Friendship>;
  addBadgeToUser?: Maybe<Badge>;
  addNewSmartDevice?: Maybe<SmartDevice>;
  adminDeleteUserAccount?: Maybe<UserAccount>;
  authenticateUser: PublicUserAccount;
  banUserAccount?: Maybe<BanLog>;
  bulkCreateSessions?: Maybe<Scalars['Void']>;
  bulkCreateSolves?: Maybe<Scalars['Void']>;
  cancelMembership?: Maybe<Scalars['Boolean']>;
  changeSmartDeviceName?: Maybe<SmartDevice>;
  checkForgotPasswordCode?: Maybe<Scalars['Boolean']>;
  createAnnouncement?: Maybe<Announcement>;
  createBadgeType?: Maybe<BadgeType>;
  createCustomCubeType?: Maybe<CustomCubeType>;
  createCustomTrainer?: Maybe<CustomTrainer>;
  createDemoSolve?: Maybe<DemoSolve>;
  createGameSession?: Maybe<GameSession>;
  createIntegration?: Maybe<Integration>;
  createMatchWithNewSession?: Maybe<Match>;
  createSession?: Maybe<Session>;
  createSolve?: Maybe<Solve>;
  createUserAccount?: Maybe<PublicUserAccount>;
  deleteAlgorithmOverride?: Maybe<AlgorithmOverride>;
  deleteAllSolves?: Maybe<Scalars['Void']>;
  deleteAllSolvesInSession?: Maybe<Scalars['Void']>;
  deleteAllTrainingSolves?: Maybe<Scalars['Void']>;
  deleteAnnouncement?: Maybe<Scalars['Boolean']>;
  deleteBadgeType?: Maybe<BadgeType>;
  deleteCustomCubeType?: Maybe<CustomCubeType>;
  deleteCustomTrainer?: Maybe<CustomTrainer>;
  deleteFriendshipRequest?: Maybe<FriendshipRequest>;
  deleteGameSession?: Maybe<GameSession>;
  deleteIntegration?: Maybe<Integration>;
  deleteNotification?: Maybe<Notification>;
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
  generateBuyLink?: Maybe<Scalars['String']>;
  logOut: PublicUserAccount;
  markAnnouncementAsViewed?: Maybe<Scalars['Boolean']>;
  markNotificationAsRead?: Maybe<Notification>;
  mergeSessions?: Maybe<Session>;
  publishTopAverages?: Maybe<TopAverage>;
  publishTopSolve?: Maybe<TopSolve>;
  publishWcaRecord?: Maybe<WcaRecord>;
  removeBadgeFromUser?: Maybe<Badge>;
  reorderSessions?: Maybe<Scalars['Void']>;
  reportProfile?: Maybe<Report>;
  resetSettings?: Maybe<Setting>;
  resolveReports?: Maybe<Scalars['Float']>;
  sendForgotPasswordCode?: Maybe<Scalars['Void']>;
  sendFriendshipRequest?: Maybe<FriendshipRequest>;
  setSetting?: Maybe<Setting>;
  setTimerBackgroundHex: TimerBackground;
  setVerifiedStatus?: Maybe<UserAccount>;
  unbanUserAccount?: Maybe<UserAccount>;
  unfriend?: Maybe<Friendship>;
  unpublishWcaRecord?: Maybe<WcaRecord>;
  unsubEmails?: Maybe<Scalars['Boolean']>;
  updateAlgorithmOverride?: Maybe<AlgorithmOverride>;
  updateAnnouncement?: Maybe<Announcement>;
  updateCustomTrainer?: Maybe<CustomTrainer>;
  updateForgotPassword?: Maybe<PublicUserAccount>;
  updateNotificationPreferences?: Maybe<NotificationPreference>;
  updateOfflineHash?: Maybe<Scalars['String']>;
  updateProfile: Profile;
  updateSession?: Maybe<Session>;
  updateSolve: Solve;
  updateStatsModuleBlocks?: Maybe<StatsModule>;
  updateUserAccount?: Maybe<PublicUserAccount>;
  updateUserPassword?: Maybe<PublicUserAccount>;
  uploadProfileHeader: Image;
  uploadProfilePicture: Image;
  uploadTimerBackground: TimerBackground;
};


export type MutationAcceptFriendshipRequestArgs = {
  friendshipRequestId?: InputMaybe<Scalars['String']>;
};


export type MutationAddBadgeToUserArgs = {
  badgeTypeId?: InputMaybe<Scalars['String']>;
  userId?: InputMaybe<Scalars['String']>;
};


export type MutationAddNewSmartDeviceArgs = {
  deviceId?: InputMaybe<Scalars['String']>;
  originalName?: InputMaybe<Scalars['String']>;
};


export type MutationAdminDeleteUserAccountArgs = {
  userId?: InputMaybe<Scalars['String']>;
};


export type MutationAuthenticateUserArgs = {
  email: Scalars['String'];
  password: Scalars['String'];
  remember?: InputMaybe<Scalars['Boolean']>;
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


export type MutationCreateGameSessionArgs = {
  gameType?: InputMaybe<GameType>;
  matchId?: InputMaybe<Scalars['String']>;
};


export type MutationCreateIntegrationArgs = {
  code?: InputMaybe<Scalars['String']>;
  integrationType?: InputMaybe<IntegrationType>;
};


export type MutationCreateMatchWithNewSessionArgs = {
  input?: InputMaybe<MatchSessionInput>;
};


export type MutationCreateSessionArgs = {
  input?: InputMaybe<SessionInput>;
};


export type MutationCreateSolveArgs = {
  input?: InputMaybe<SolveInput>;
};


export type MutationCreateUserAccountArgs = {
  email: Scalars['String'];
  first_name: Scalars['String'];
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


export type MutationDeleteFriendshipRequestArgs = {
  friendshipRequestId?: InputMaybe<Scalars['String']>;
};


export type MutationDeleteGameSessionArgs = {
  id?: InputMaybe<Scalars['String']>;
};


export type MutationDeleteIntegrationArgs = {
  integrationType?: InputMaybe<IntegrationType>;
};


export type MutationDeleteNotificationArgs = {
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


export type MutationGenerateBuyLinkArgs = {
  priceId?: InputMaybe<Scalars['String']>;
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


export type MutationRemoveBadgeFromUserArgs = {
  badgeTypeId?: InputMaybe<Scalars['String']>;
  userId?: InputMaybe<Scalars['String']>;
};


export type MutationReorderSessionsArgs = {
  ids?: InputMaybe<Array<InputMaybe<Scalars['String']>>>;
};


export type MutationReportProfileArgs = {
  reason?: InputMaybe<Scalars['String']>;
  userId?: InputMaybe<Scalars['String']>;
};


export type MutationResolveReportsArgs = {
  userId?: InputMaybe<Scalars['String']>;
};


export type MutationSendForgotPasswordCodeArgs = {
  email?: InputMaybe<Scalars['String']>;
};


export type MutationSendFriendshipRequestArgs = {
  toUserId?: InputMaybe<Scalars['String']>;
};


export type MutationSetSettingArgs = {
  input?: InputMaybe<SettingInput>;
};


export type MutationSetTimerBackgroundHexArgs = {
  hex?: InputMaybe<Scalars['String']>;
};


export type MutationSetVerifiedStatusArgs = {
  userId?: InputMaybe<Scalars['String']>;
  verified?: InputMaybe<Scalars['Boolean']>;
};


export type MutationUnbanUserAccountArgs = {
  userId?: InputMaybe<Scalars['String']>;
};


export type MutationUnfriendArgs = {
  targetUserId?: InputMaybe<Scalars['String']>;
};


export type MutationUnpublishWcaRecordArgs = {
  recordId?: InputMaybe<Scalars['String']>;
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


export type MutationUploadProfileHeaderArgs = {
  file?: InputMaybe<Scalars['Upload']>;
};


export type MutationUploadProfilePictureArgs = {
  file?: InputMaybe<Scalars['Upload']>;
};


export type MutationUploadTimerBackgroundArgs = {
  file?: InputMaybe<Scalars['Upload']>;
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
  elo_refund?: Maybe<Scalars['Boolean']>;
  friend_request?: Maybe<Scalars['Boolean']>;
  friend_request_accept?: Maybe<Scalars['Boolean']>;
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

export type PaginatedEloLeaderboards = {
  __typename?: 'PaginatedEloLeaderboards';
  hasMore?: Maybe<Scalars['Boolean']>;
  items?: Maybe<Array<Maybe<EloRating>>>;
  total?: Maybe<Scalars['Int']>;
};

export type PaginatedFriendshipRequests = {
  __typename?: 'PaginatedFriendshipRequests';
  hasMore?: Maybe<Scalars['Boolean']>;
  items?: Maybe<Array<Maybe<FriendshipRequest>>>;
  total?: Maybe<Scalars['Int']>;
};

export type PaginatedFriendships = {
  __typename?: 'PaginatedFriendships';
  hasMore?: Maybe<Scalars['Boolean']>;
  items?: Maybe<Array<Maybe<Friendship>>>;
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

export type PublicUserAccount = IPublicUserAccount & {
  __typename?: 'PublicUserAccount';
  admin?: Maybe<Scalars['Boolean']>;
  badges?: Maybe<Array<Maybe<Badge>>>;
  banned_forever?: Maybe<Scalars['Boolean']>;
  banned_until?: Maybe<Scalars['DateTime']>;
  created_at?: Maybe<Scalars['DateTime']>;
  elo_rating?: Maybe<EloRating>;
  id?: Maybe<Scalars['String']>;
  integrations?: Maybe<Array<Maybe<Integration>>>;
  is_pro?: Maybe<Scalars['Boolean']>;
  last_solve_at?: Maybe<Scalars['DateTime']>;
  mod?: Maybe<Scalars['Boolean']>;
  profile?: Maybe<Profile>;
  top_averages?: Maybe<Array<Maybe<TopAverage>>>;
  top_solves?: Maybe<Array<Maybe<TopSolve>>>;
  username?: Maybe<Scalars['String']>;
  verified?: Maybe<Scalars['Boolean']>;
};

export type Query = {
  __typename?: 'Query';
  adminUserSearch?: Maybe<PaginatedUserAccountsForAdmin>;
  algorithmOverrides?: Maybe<Array<Maybe<AlgorithmOverride>>>;
  allFriendships?: Maybe<Array<Maybe<Friendship>>>;
  badgeTypes?: Maybe<Array<Maybe<BadgeType>>>;
  customCubeTypes?: Maybe<Array<Maybe<CustomCubeType>>>;
  customTrainer?: Maybe<CustomTrainer>;
  customTrainers?: Maybe<Array<Maybe<CustomTrainer>>>;
  eloLeaderboards?: Maybe<PaginatedEloLeaderboards>;
  friendshipRequestsReceived?: Maybe<PaginatedFriendshipRequests>;
  friendshipRequestsSent?: Maybe<PaginatedFriendshipRequests>;
  friendships?: Maybe<PaginatedFriendships>;
  gameSession?: Maybe<GameSession>;
  gameSessions?: Maybe<Array<Maybe<GameSession>>>;
  getActiveAnnouncements?: Maybe<Array<Maybe<Announcement>>>;
  getAllAnnouncements?: Maybe<Array<Maybe<Announcement>>>;
  getMyAnnouncementHistory?: Maybe<Array<Maybe<Announcement>>>;
  getUnreadAnnouncementCount?: Maybe<UnreadAnnouncementCount>;
  getUserAccountForAdmin?: Maybe<UserAccountForAdmin>;
  integration?: Maybe<Integration>;
  integrations?: Maybe<Array<Maybe<Integration>>>;
  match?: Maybe<Match>;
  matchByLinkCode?: Maybe<Match>;
  matchBySpectateCode?: Maybe<Match>;
  matchSession: MatchSession;
  me: UserAccount;
  membership?: Maybe<Membership>;
  membershipOptions?: Maybe<MembershipOptions>;
  myEloLeaderboardsPosition?: Maybe<Scalars['Int']>;
  myWcaRecords?: Maybe<Array<Maybe<WcaRecord>>>;
  notificationPreferences?: Maybe<NotificationPreference>;
  notifications?: Maybe<Array<Maybe<Notification>>>;
  profile: Profile;
  receivedFriendshipRequestsFromUser?: Maybe<Array<Maybe<FriendshipRequest>>>;
  reports?: Maybe<Array<Maybe<ReportSummary>>>;
  sentFriendshipRequestsToUser?: Maybe<Array<Maybe<FriendshipRequest>>>;
  sessions?: Maybe<Array<Maybe<Session>>>;
  settings?: Maybe<Setting>;
  smartDevices?: Maybe<Array<Maybe<SmartDevice>>>;
  solve?: Maybe<Solve>;
  solveByShareCode?: Maybe<Solve>;
  solveList?: Maybe<SolveList>;
  solves?: Maybe<Array<Maybe<Solve>>>;
  stats?: Maybe<Stats>;
  statsModule?: Maybe<StatsModule>;
  topAverages?: Maybe<Array<Maybe<TopAverage>>>;
  topSolves?: Maybe<Array<Maybe<TopSolve>>>;
  unreadNotificationCount?: Maybe<Scalars['Int']>;
  userSearch?: Maybe<PaginatedUserAccounts>;
  wcaMe?: Maybe<WcaAccount>;
  wcaRecords?: Maybe<Array<Maybe<WcaRecord>>>;
};


export type QueryAdminUserSearchArgs = {
  pageArgs?: InputMaybe<PaginationArgsInput>;
};


export type QueryCustomTrainerArgs = {
  id?: InputMaybe<Scalars['String']>;
};


export type QueryCustomTrainersArgs = {
  pageArgs?: InputMaybe<PaginationArgsInput>;
};


export type QueryEloLeaderboardsArgs = {
  pageArgs?: InputMaybe<PaginationArgsInput>;
};


export type QueryFriendshipRequestsReceivedArgs = {
  page?: InputMaybe<Scalars['Int']>;
  pageSize?: InputMaybe<Scalars['Int']>;
  searchQuery?: InputMaybe<Scalars['String']>;
};


export type QueryFriendshipRequestsSentArgs = {
  page?: InputMaybe<Scalars['Int']>;
  pageSize?: InputMaybe<Scalars['Int']>;
  searchQuery?: InputMaybe<Scalars['String']>;
};


export type QueryFriendshipsArgs = {
  page?: InputMaybe<Scalars['Int']>;
  pageSize?: InputMaybe<Scalars['Int']>;
  searchQuery?: InputMaybe<Scalars['String']>;
};


export type QueryGameSessionArgs = {
  id?: InputMaybe<Scalars['String']>;
};


export type QueryGetAllAnnouncementsArgs = {
  filter?: InputMaybe<AnnouncementFilterInput>;
};


export type QueryGetMyAnnouncementHistoryArgs = {
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
};


export type QueryGetUserAccountForAdminArgs = {
  userId?: InputMaybe<Scalars['String']>;
};


export type QueryIntegrationArgs = {
  integrationType?: InputMaybe<IntegrationType>;
};


export type QueryMatchArgs = {
  id?: InputMaybe<Scalars['String']>;
};


export type QueryMatchByLinkCodeArgs = {
  code?: InputMaybe<Scalars['String']>;
};


export type QueryMatchBySpectateCodeArgs = {
  code?: InputMaybe<Scalars['String']>;
};


export type QueryMatchSessionArgs = {
  id?: InputMaybe<Scalars['String']>;
};


export type QueryNotificationsArgs = {
  page?: InputMaybe<Scalars['Int']>;
};


export type QueryProfileArgs = {
  username?: InputMaybe<Scalars['String']>;
};


export type QueryReceivedFriendshipRequestsFromUserArgs = {
  userId?: InputMaybe<Scalars['String']>;
};


export type QuerySentFriendshipRequestsToUserArgs = {
  userId?: InputMaybe<Scalars['String']>;
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


export type QueryTopAveragesArgs = {
  cubeType?: InputMaybe<Scalars['String']>;
  page?: InputMaybe<Scalars['Int']>;
};


export type QueryTopSolvesArgs = {
  cubeType?: InputMaybe<Scalars['String']>;
  page?: InputMaybe<Scalars['Int']>;
};


export type QueryUserSearchArgs = {
  pageArgs?: InputMaybe<PaginationArgsInput>;
};


export type QueryWcaRecordsArgs = {
  userId?: InputMaybe<Scalars['String']>;
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

export type Setting = {
  __typename?: 'Setting';
  beta_tester?: Maybe<Scalars['Boolean']>;
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
  use_space_with_smart_cube?: Maybe<Scalars['Boolean']>;
  user_id?: Maybe<Scalars['String']>;
  zero_out_time_after_solve?: Maybe<Scalars['Boolean']>;
};

export type SettingInput = {
  beta_tester?: InputMaybe<Scalars['Boolean']>;
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
  use_space_with_smart_cube?: InputMaybe<Scalars['Boolean']>;
  zero_out_time_after_solve?: InputMaybe<Scalars['Boolean']>;
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
  game_session_id?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  inspection_time?: Maybe<Scalars['Float']>;
  is_smart_cube?: Maybe<Scalars['Boolean']>;
  match_id?: Maybe<Scalars['String']>;
  match_participant_id?: Maybe<Scalars['String']>;
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
  game_session_id?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['String']>;
  inspection_time?: InputMaybe<Scalars['Float']>;
  is_smart_cube?: InputMaybe<Scalars['Boolean']>;
  match_id?: InputMaybe<Scalars['String']>;
  match_participant_id?: InputMaybe<Scalars['String']>;
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
  friend_count?: Maybe<Scalars['Float']>;
  match_max_win_streak?: Maybe<Scalars['Float']>;
  match_solve_count?: Maybe<Scalars['Float']>;
  matches_lost?: Maybe<Scalars['Float']>;
  matches_played?: Maybe<Scalars['Float']>;
  matches_tied?: Maybe<Scalars['Float']>;
  matches_won?: Maybe<Scalars['Float']>;
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

export enum SubscriptionStatus {
  Active = 'ACTIVE',
  Canceled = 'CANCELED',
  Incomplete = 'INCOMPLETE',
  IncompleteExpired = 'INCOMPLETE_EXPIRED',
  None = 'NONE',
  PastDue = 'PAST_DUE',
  TrialExpired = 'TRIAL_EXPIRED',
  Trialing = 'TRIALING',
  Unpaid = 'UNPAID'
}

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
};

export type UserAccount = IPublicUserAccount & IUserAccount & {
  __typename?: 'UserAccount';
  admin?: Maybe<Scalars['Boolean']>;
  badges?: Maybe<Array<Maybe<Badge>>>;
  banned_forever?: Maybe<Scalars['Boolean']>;
  banned_until?: Maybe<Scalars['DateTime']>;
  bans?: Maybe<Array<Maybe<BanLog>>>;
  created_at?: Maybe<Scalars['DateTime']>;
  elo_rating?: Maybe<EloRating>;
  email?: Maybe<Scalars['String']>;
  first_name?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  integrations?: Maybe<Array<Maybe<Integration>>>;
  is_pro?: Maybe<Scalars['Boolean']>;
  join_country?: Maybe<Scalars['String']>;
  last_name?: Maybe<Scalars['String']>;
  last_solve_at?: Maybe<Scalars['DateTime']>;
  mod?: Maybe<Scalars['Boolean']>;
  offline_hash?: Maybe<Scalars['String']>;
  pro_status?: Maybe<SubscriptionStatus>;
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
  chat_messages?: Maybe<Array<Maybe<ChatMessage>>>;
  created_at?: Maybe<Scalars['DateTime']>;
  elo_rating?: Maybe<EloRating>;
  email?: Maybe<Scalars['String']>;
  first_name?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  integrations?: Maybe<Array<Maybe<Integration>>>;
  is_pro?: Maybe<Scalars['Boolean']>;
  join_country?: Maybe<Scalars['String']>;
  join_ip?: Maybe<Scalars['String']>;
  last_name?: Maybe<Scalars['String']>;
  last_solve_at?: Maybe<Scalars['DateTime']>;
  mod?: Maybe<Scalars['Boolean']>;
  notification_preferences?: Maybe<NotificationPreference>;
  offline_hash?: Maybe<Scalars['String']>;
  pro_status?: Maybe<SubscriptionStatus>;
  profile?: Maybe<Profile>;
  reports_for?: Maybe<Array<Maybe<Report>>>;
  settings?: Maybe<Setting>;
  summary?: Maybe<UserAccountSummary>;
  timer_background?: Maybe<TimerBackground>;
  top_averages?: Maybe<Array<Maybe<TopAverage>>>;
  top_solves?: Maybe<Array<Maybe<TopSolve>>>;
  username?: Maybe<Scalars['String']>;
  verified?: Maybe<Scalars['Boolean']>;
};

export type UserAccountMatchesSummary = {
  __typename?: 'UserAccountMatchesSummary';
  count?: Maybe<Scalars['Float']>;
  losses?: Maybe<Scalars['Float']>;
  wins?: Maybe<Scalars['Float']>;
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
  match_solves?: Maybe<Array<Maybe<UserAccountSolvesSummary>>>;
  matches?: Maybe<UserAccountMatchesSummary>;
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

export type MiniSolveFragmentFragment = { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, session_id?: string | null, trainer_name?: string | null, bulk?: boolean | null, scramble?: string | null, from_timer?: boolean | null, training_session_id?: string | null, dnf?: boolean | null, plus_two?: boolean | null, is_smart_cube?: boolean | null, created_at?: any | null, started_at?: any | null, ended_at?: any | null };

export type StatsFragmentFragment = { __typename?: 'Stats', friend_count?: number | null, matches_played?: number | null, matches_won?: number | null, profile_views?: number | null, match_max_win_streak?: number | null, match_solve_count?: number | null, solve_views?: number | null };

export type StatsModuleBlockFragmentFragment = { __typename?: 'StatsModuleBlock', statType?: string | null, sortBy?: string | null, session?: boolean | null, colorName?: string | null, averageCount?: number | null };

export type AlgorithmOverrideFragmentFragment = { __typename?: 'AlgorithmOverride', cube_key?: string | null, rotate?: number | null, solution?: string | null };

export type TrainerFavoriteFragmentFragment = { __typename?: 'TrainerFavorite', cube_key?: string | null };

export type TrainerAlgorithmFragmentFragment = { __typename?: 'TrainerAlgorithm', id?: string | null, name?: string | null, scrambles?: string | null, solution?: string | null, pro_only?: boolean | null, cube_type?: string | null, algo_type?: string | null, colors?: string | null, group_name?: string | null };

export type SessionFragmentFragment = { __typename?: 'Session', id?: string | null, name?: string | null, created_at?: any | null, order?: number | null };

export type SolveFragmentFragment = { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null };

export type GameOptionsFragmentFragment = { __typename?: 'GameOptions', id?: string | null, cube_type?: string | null, game_session_id?: string | null, game_type?: GameType | null, elimination_percent_change_rate?: number | null, elimination_starting_time_seconds?: number | null, gauntlet_time_multiplier?: number | null, head_to_head_target_win_count?: number | null, match_session_id?: string | null };

export type CustomCubeTypeFragmentFragment = { __typename?: 'CustomCubeType', id?: string | null, user_id?: string | null, name?: string | null, created_at?: any | null, scramble?: string | null, private?: boolean | null };

export type SettingsFragmentFragment = { __typename?: 'Setting', id?: string | null, user_id?: string | null, focus_mode?: boolean | null, freeze_time?: number | null, inspection?: boolean | null, manual_entry?: boolean | null, inspection_delay?: number | null, session_id?: string | null, inverse_time_list?: boolean | null, hide_time_when_solving?: boolean | null, nav_collapsed?: boolean | null, timer_decimal_points?: number | null, pb_confetti?: boolean | null, play_inspection_sound?: boolean | null, zero_out_time_after_solve?: boolean | null, confirm_delete_solve?: boolean | null, use_space_with_smart_cube?: boolean | null, require_period_in_manual_time_entry?: boolean | null, beta_tester?: boolean | null, cube_type?: string | null, custom_cube_types?: Array<{ __typename?: 'CustomCubeType', id?: string | null, user_id?: string | null, name?: string | null, created_at?: any | null, scramble?: string | null, private?: boolean | null } | null> | null };

export type ImageFragmentFragment = { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null };

export type EloRatingFragmentFragment = { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null };

type PublicUserFragment_InternalUserAccount_Fragment = { __typename?: 'InternalUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null };

type PublicUserFragment_PublicUserAccount_Fragment = { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null };

type PublicUserFragment_UserAccount_Fragment = { __typename?: 'UserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null };

type PublicUserFragment_UserAccountForAdmin_Fragment = { __typename?: 'UserAccountForAdmin', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null };

export type PublicUserFragmentFragment = PublicUserFragment_InternalUserAccount_Fragment | PublicUserFragment_PublicUserAccount_Fragment | PublicUserFragment_UserAccount_Fragment | PublicUserFragment_UserAccountForAdmin_Fragment;

export type EloRatingWithUserFragmentFragment = { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null };

type PublicUserWithEloFragment_InternalUserAccount_Fragment = { __typename?: 'InternalUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null };

type PublicUserWithEloFragment_PublicUserAccount_Fragment = { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null };

type PublicUserWithEloFragment_UserAccount_Fragment = { __typename?: 'UserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null };

type PublicUserWithEloFragment_UserAccountForAdmin_Fragment = { __typename?: 'UserAccountForAdmin', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null };

export type PublicUserWithEloFragmentFragment = PublicUserWithEloFragment_InternalUserAccount_Fragment | PublicUserWithEloFragment_PublicUserAccount_Fragment | PublicUserWithEloFragment_UserAccount_Fragment | PublicUserWithEloFragment_UserAccountForAdmin_Fragment;

type UserAccountFragment_InternalUserAccount_Fragment = { __typename?: 'InternalUserAccount', email?: string | null, offline_hash?: string | null, pro_status?: SubscriptionStatus | null, id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null };

type UserAccountFragment_UserAccount_Fragment = { __typename?: 'UserAccount', email?: string | null, offline_hash?: string | null, pro_status?: SubscriptionStatus | null, id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null };

type UserAccountFragment_UserAccountForAdmin_Fragment = { __typename?: 'UserAccountForAdmin', email?: string | null, offline_hash?: string | null, pro_status?: SubscriptionStatus | null, id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null };

export type UserAccountFragmentFragment = UserAccountFragment_InternalUserAccount_Fragment | UserAccountFragment_UserAccount_Fragment | UserAccountFragment_UserAccountForAdmin_Fragment;

export type SolveWithUserFragmentFragment = { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null };

export type ChatMessageFragmentFragment = { __typename?: 'ChatMessage', id?: string | null, message?: string | null, created_at?: any | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null };

export type FriendshipFragmentFragment = { __typename?: 'Friendship', id?: string | null, user_id?: string | null, other_user_id?: string | null, created_at?: any | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, other_user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null };

export type NotificationPreferenceFragmentFragment = { __typename?: 'NotificationPreference', friend_request?: boolean | null, friend_request_accept?: boolean | null, marketing_emails?: boolean | null, elo_refund?: boolean | null };

export type FriendshipRequestFragmentFragment = { __typename?: 'FriendshipRequest', id?: string | null, from_id?: string | null, to_id?: string | null, accepted?: boolean | null, created_at?: any | null, from_user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, to_user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null };

export type NotificationFragmentFragment = { __typename?: 'Notification', id?: string | null, user_id?: string | null, notification_type?: string | null, notification_category_name?: string | null, triggering_user_id?: string | null, in_app_message?: string | null, read_at?: any | null, message?: string | null, icon?: string | null, link?: string | null, link_text?: string | null, subject?: string | null, created_at?: any | null, triggering_user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null };

export type MatchParticipantFragmentFragment = { __typename?: 'MatchParticipant', id?: string | null, user_id?: string | null, created_at?: any | null, forfeited?: boolean | null, lost?: boolean | null, position?: number | null, resigned?: boolean | null, won?: boolean | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, solves?: Array<{ __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null> | null };

export type MatchSessionFragmentFragment = { __typename?: 'MatchSession', created_at?: any | null, id?: string | null, match_type?: string | null, custom_match?: boolean | null, created_by_id?: string | null, min_players?: number | null, max_players?: number | null, chat_messages?: Array<{ __typename?: 'ChatMessage', id?: string | null, message?: string | null, created_at?: any | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null } | null> | null, game_options?: { __typename?: 'GameOptions', id?: string | null, cube_type?: string | null, game_session_id?: string | null, game_type?: GameType | null, elimination_percent_change_rate?: number | null, elimination_starting_time_seconds?: number | null, gauntlet_time_multiplier?: number | null, head_to_head_target_win_count?: number | null, match_session_id?: string | null } | null };

export type EloLogFragmentFragment = { __typename?: 'EloLog', id?: string | null, player_id?: string | null, player_new_game_count?: string | null, opponent_id?: string | null, opponent_new_game_count?: string | null, cube_type?: string | null, match_id?: string | null, elo_change?: number | null, player_new_elo_rating?: number | null, opponent_new_elo_rating?: number | null, updated_at?: any | null, created_at?: any | null };

export type MatchFragmentFragment = { __typename?: 'Match', id?: string | null, link_code?: string | null, spectate_code?: string | null, ended_at?: any | null, started_at?: any | null, winner_id?: string | null, aborted?: boolean | null, match_session_id?: string | null, created_at?: any | null, elo_log?: Array<{ __typename?: 'EloLog', id?: string | null, player_id?: string | null, player_new_game_count?: string | null, opponent_id?: string | null, opponent_new_game_count?: string | null, cube_type?: string | null, match_id?: string | null, elo_change?: number | null, player_new_elo_rating?: number | null, opponent_new_elo_rating?: number | null, updated_at?: any | null, created_at?: any | null } | null> | null, match_session?: { __typename?: 'MatchSession', created_at?: any | null, id?: string | null, match_type?: string | null, custom_match?: boolean | null, created_by_id?: string | null, min_players?: number | null, max_players?: number | null, chat_messages?: Array<{ __typename?: 'ChatMessage', id?: string | null, message?: string | null, created_at?: any | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null } | null> | null, game_options?: { __typename?: 'GameOptions', id?: string | null, cube_type?: string | null, game_session_id?: string | null, game_type?: GameType | null, elimination_percent_change_rate?: number | null, elimination_starting_time_seconds?: number | null, gauntlet_time_multiplier?: number | null, head_to_head_target_win_count?: number | null, match_session_id?: string | null } | null } | null, participants?: Array<{ __typename?: 'MatchParticipant', id?: string | null, user_id?: string | null, created_at?: any | null, forfeited?: boolean | null, lost?: boolean | null, position?: number | null, resigned?: boolean | null, won?: boolean | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, solves?: Array<{ __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null> | null } | null> | null };

export type TopSolveFragmentFragment = { __typename?: 'TopSolve', id?: string | null, time?: number | null, cube_type?: string | null, created_at?: any | null, solve?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null };

export type TopAverageFragmentFragment = { __typename?: 'TopAverage', id?: string | null, time?: number | null, cube_type?: string | null, created_at?: any | null, solve_1?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, solve_2?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, solve_3?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, solve_4?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, solve_5?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null };

export type ProfileFragmentFragment = { __typename?: 'Profile', id?: string | null, bio?: string | null, three_method?: string | null, three_goal?: string | null, main_three_cube?: string | null, favorite_event?: string | null, youtube_link?: string | null, twitter_link?: string | null, user_id?: string | null, reddit_link?: string | null, twitch_link?: string | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, top_solves?: Array<{ __typename?: 'TopSolve', id?: string | null, time?: number | null, cube_type?: string | null, created_at?: any | null, solve?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null } | null> | null, top_averages?: Array<{ __typename?: 'TopAverage', id?: string | null, time?: number | null, cube_type?: string | null, created_at?: any | null, solve_1?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, solve_2?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, solve_3?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, solve_4?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, solve_5?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null } | null> | null, header_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null, pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null };

export type ReportFragmentFragment = { __typename?: 'Report', id?: string | null, reported_user_id?: string | null, created_by_id?: string | null, reason?: string | null, resolved_at?: any | null, created_at?: any | null, created_by?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, reported_user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null };

export type GameSessionFragmentFragment = { __typename?: 'GameSession', id?: string | null, created_at?: any | null, match?: { __typename?: 'Match', id?: string | null, winner_id?: string | null, started_at?: any | null, ended_at?: any | null, created_at?: any | null, participants?: Array<{ __typename?: 'MatchParticipant', id?: string | null, user_id?: string | null, position?: number | null, resigned?: boolean | null, forfeited?: boolean | null, won?: boolean | null, lost?: boolean | null, created_at?: any | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, solves?: Array<{ __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null> | null } | null> | null, match_session?: { __typename?: 'MatchSession', min_players?: number | null, max_players?: number | null, match_type?: string | null, custom_match?: boolean | null, created_at?: any | null } | null } | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null } | null, solves?: Array<{ __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null> | null };

export type MembershipPricingFragmentFragment = { __typename?: 'MembershipPricing', id?: string | null, currency?: string | null, unit_amount?: number | null, interval_count?: number | null, interval?: string | null };

export type IntegrationFragmentFragment = { __typename?: 'Integration', id?: string | null, auth_expires_at?: any | null, service_name?: IntegrationType | null, created_at?: any | null };

export type MembershipFragmentFragment = { __typename?: 'Membership', status?: SubscriptionStatus | null, canceled_at?: number | null, ended_at?: number | null, days_until_due?: number | null, cancel_at_period_end?: boolean | null, current_period_end?: number | null, start_date?: number | null, pricing?: { __typename?: 'MembershipPricing', id?: string | null, currency?: string | null, unit_amount?: number | null, interval_count?: number | null, interval?: string | null } | null };

export type MembershipOptionsFragmentFragment = { __typename?: 'MembershipOptions', month?: { __typename?: 'MembershipPricing', id?: string | null, currency?: string | null, unit_amount?: number | null, interval_count?: number | null, interval?: string | null } | null, year?: { __typename?: 'MembershipPricing', id?: string | null, currency?: string | null, unit_amount?: number | null, interval_count?: number | null, interval?: string | null } | null };

export type CustomTrainerFragmentFragment = { __typename?: 'CustomTrainer', id?: string | null, solution?: string | null, scrambles?: string | null, colors?: string | null, description?: string | null, alt_solutions?: string | null, group_name?: string | null, algo_type?: string | null, three_d?: boolean | null, cube_type?: string | null, name?: string | null, key?: string | null, copy_of_id?: string | null, copy_of?: { __typename?: 'CustomTrainer', user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null } | null } | null };

export type PublicCustomTrainerRecordFragmentFragment = { __typename?: 'CustomTrainer', user_id?: string | null, like_count?: number | null, id?: string | null, solution?: string | null, scrambles?: string | null, colors?: string | null, description?: string | null, alt_solutions?: string | null, group_name?: string | null, algo_type?: string | null, three_d?: boolean | null, cube_type?: string | null, name?: string | null, key?: string | null, copy_of_id?: string | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, copy_of?: { __typename?: 'CustomTrainer', user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null } | null } | null };

export type TimerBackgroundFragmentFragment = { __typename?: 'TimerBackground', created_at?: any | null, hex?: string | null, storage_path?: string | null, id?: string | null, url?: string | null };

type UserForMeFragment_InternalUserAccount_Fragment = { __typename?: 'InternalUserAccount', email?: string | null, join_country?: string | null, id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, timer_background?: { __typename?: 'TimerBackground', created_at?: any | null, hex?: string | null, storage_path?: string | null, id?: string | null, url?: string | null } | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null };

type UserForMeFragment_UserAccount_Fragment = { __typename?: 'UserAccount', email?: string | null, join_country?: string | null, id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, timer_background?: { __typename?: 'TimerBackground', created_at?: any | null, hex?: string | null, storage_path?: string | null, id?: string | null, url?: string | null } | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null };

type UserForMeFragment_UserAccountForAdmin_Fragment = { __typename?: 'UserAccountForAdmin', email?: string | null, join_country?: string | null, id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, timer_background?: { __typename?: 'TimerBackground', created_at?: any | null, hex?: string | null, storage_path?: string | null, id?: string | null, url?: string | null } | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null };

export type UserForMeFragmentFragment = UserForMeFragment_InternalUserAccount_Fragment | UserForMeFragment_UserAccount_Fragment | UserForMeFragment_UserAccountForAdmin_Fragment;

export type UserAccountMatchesSummaryFragmentFragment = { __typename?: 'UserAccountMatchesSummary', count?: number | null, wins?: number | null, losses?: number | null };

export type UserAccountSolvesSummaryFragmentFragment = { __typename?: 'UserAccountSolvesSummary', count?: number | null, average?: number | null, min_time?: number | null, max_time?: number | null, sum?: number | null, cube_type?: string | null };

export type UserAccountSummaryFragmentFragment = { __typename?: 'UserAccountSummary', solves?: number | null, reports_for?: number | null, reports_created?: number | null, profile_views?: number | null, bans?: number | null, matches?: { __typename?: 'UserAccountMatchesSummary', count?: number | null, wins?: number | null, losses?: number | null } | null, match_solves?: Array<{ __typename?: 'UserAccountSolvesSummary', count?: number | null, average?: number | null, min_time?: number | null, max_time?: number | null, sum?: number | null, cube_type?: string | null } | null> | null, timer_solves?: Array<{ __typename?: 'UserAccountSolvesSummary', count?: number | null, average?: number | null, min_time?: number | null, max_time?: number | null, sum?: number | null, cube_type?: string | null } | null> | null };

export type UserForAdminFragmentFragment = { __typename?: 'UserAccountForAdmin', email?: string | null, join_country?: string | null, join_ip?: string | null, id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, reports_for?: Array<{ __typename?: 'Report', id?: string | null, reported_user_id?: string | null, created_by_id?: string | null, reason?: string | null, resolved_at?: any | null, created_at?: any | null, created_by?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, reported_user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null } | null> | null, settings?: { __typename?: 'Setting', id?: string | null, user_id?: string | null, focus_mode?: boolean | null, freeze_time?: number | null, inspection?: boolean | null, manual_entry?: boolean | null, inspection_delay?: number | null, session_id?: string | null, inverse_time_list?: boolean | null, hide_time_when_solving?: boolean | null, nav_collapsed?: boolean | null, timer_decimal_points?: number | null, pb_confetti?: boolean | null, play_inspection_sound?: boolean | null, zero_out_time_after_solve?: boolean | null, confirm_delete_solve?: boolean | null, use_space_with_smart_cube?: boolean | null, require_period_in_manual_time_entry?: boolean | null, beta_tester?: boolean | null, cube_type?: string | null, custom_cube_types?: Array<{ __typename?: 'CustomCubeType', id?: string | null, user_id?: string | null, name?: string | null, created_at?: any | null, scramble?: string | null, private?: boolean | null } | null> | null } | null, chat_messages?: Array<{ __typename?: 'ChatMessage', id?: string | null, message?: string | null, created_at?: any | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null } | null> | null, notification_preferences?: { __typename?: 'NotificationPreference', friend_request?: boolean | null, friend_request_accept?: boolean | null, marketing_emails?: boolean | null, elo_refund?: boolean | null } | null, summary?: { __typename?: 'UserAccountSummary', solves?: number | null, reports_for?: number | null, reports_created?: number | null, profile_views?: number | null, bans?: number | null, matches?: { __typename?: 'UserAccountMatchesSummary', count?: number | null, wins?: number | null, losses?: number | null } | null, match_solves?: Array<{ __typename?: 'UserAccountSolvesSummary', count?: number | null, average?: number | null, min_time?: number | null, max_time?: number | null, sum?: number | null, cube_type?: string | null } | null> | null, timer_solves?: Array<{ __typename?: 'UserAccountSolvesSummary', count?: number | null, average?: number | null, min_time?: number | null, max_time?: number | null, sum?: number | null, cube_type?: string | null } | null> | null } | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null };

export type ReportSummaryFragmentFragment = { __typename?: 'ReportSummary', last_report?: any | null, first_report?: any | null, count?: number | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, reports?: Array<{ __typename?: 'Report', id?: string | null, reported_user_id?: string | null, created_by_id?: string | null, reason?: string | null, resolved_at?: any | null, created_at?: any | null, created_by?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, reported_user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null } | null> | null };

export type DeleteFriendshipRequestMutationVariables = Exact<{
  friendshipRequestId: Scalars['String'];
}>;


export type DeleteFriendshipRequestMutation = { __typename?: 'Mutation', deleteFriendshipRequest?: { __typename?: 'FriendshipRequest', id?: string | null, from_id?: string | null, to_id?: string | null, accepted?: boolean | null, created_at?: any | null, from_user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, to_user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null } | null };

export type AcceptFriendshipRequestMutationVariables = Exact<{
  friendshipRequestId: Scalars['String'];
}>;


export type AcceptFriendshipRequestMutation = { __typename?: 'Mutation', acceptFriendshipRequest?: { __typename?: 'Friendship', id?: string | null, user_id?: string | null, other_user_id?: string | null, created_at?: any | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, other_user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null } | null };

export type UnfriendMutationVariables = Exact<{
  targetUserId: Scalars['String'];
}>;


export type UnfriendMutation = { __typename?: 'Mutation', unfriend?: { __typename?: 'Friendship', id?: string | null, user_id?: string | null, other_user_id?: string | null, created_at?: any | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, other_user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null } | null };

export type SendFriendshipRequestMutationVariables = Exact<{
  toUserId?: InputMaybe<Scalars['String']>;
}>;


export type SendFriendshipRequestMutation = { __typename?: 'Mutation', sendFriendshipRequest?: { __typename?: 'FriendshipRequest', id?: string | null, from_id?: string | null, to_id?: string | null, accepted?: boolean | null, created_at?: any | null, from_user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, to_user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null } | null };

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

export type ReceivedFriendshipRequestsFromUserQueryVariables = Exact<{
  userId: Scalars['String'];
}>;


export type ReceivedFriendshipRequestsFromUserQuery = { __typename?: 'Query', receivedFriendshipRequestsFromUser?: Array<{ __typename?: 'FriendshipRequest', id?: string | null, from_id?: string | null, to_id?: string | null, accepted?: boolean | null, created_at?: any | null, from_user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, to_user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null } | null> | null };

export type SentFriendshipRequestsToUserQueryVariables = Exact<{
  userId: Scalars['String'];
}>;


export type SentFriendshipRequestsToUserQuery = { __typename?: 'Query', sentFriendshipRequestsToUser?: Array<{ __typename?: 'FriendshipRequest', id?: string | null, from_id?: string | null, to_id?: string | null, accepted?: boolean | null, created_at?: any | null, from_user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, to_user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null } | null> | null };

export type SolveByShareCodeQueryVariables = Exact<{
  shareCode?: InputMaybe<Scalars['String']>;
}>;


export type SolveByShareCodeQuery = { __typename?: 'Query', solveByShareCode?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null };

export type ProfileQueryVariables = Exact<{
  username?: InputMaybe<Scalars['String']>;
}>;


export type ProfileQuery = { __typename?: 'Query', profile: { __typename?: 'Profile', id?: string | null, bio?: string | null, three_method?: string | null, three_goal?: string | null, main_three_cube?: string | null, favorite_event?: string | null, youtube_link?: string | null, twitter_link?: string | null, user_id?: string | null, reddit_link?: string | null, twitch_link?: string | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, top_solves?: Array<{ __typename?: 'TopSolve', id?: string | null, time?: number | null, cube_type?: string | null, created_at?: any | null, solve?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null } | null> | null, top_averages?: Array<{ __typename?: 'TopAverage', id?: string | null, time?: number | null, cube_type?: string | null, created_at?: any | null, solve_1?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, solve_2?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, solve_3?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, solve_4?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, solve_5?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, smart_device?: { __typename?: 'SmartDevice', id?: string | null, name?: string | null, internal_name?: string | null, device_id?: string | null, created_at?: any | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, elo_rating?: { __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null } | null> | null, header_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null, pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } };

export type EloLeaderboardsQueryVariables = Exact<{
  pageArgs?: InputMaybe<PaginationArgsInput>;
}>;


export type EloLeaderboardsQuery = { __typename?: 'Query', eloLeaderboards?: { __typename?: 'PaginatedEloLeaderboards', hasMore?: boolean | null, total?: number | null, items?: Array<{ __typename?: 'EloRating', id?: string | null, user_id?: string | null, profile_id?: string | null, elo_overall_rating?: number | null, games_overall_count?: number | null, elo_222_rating?: number | null, games_222_count?: number | null, elo_333_rating?: number | null, games_333_count?: number | null, elo_444_rating?: number | null, games_444_count?: number | null, updated_at?: any | null, created_at?: any | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null } | null> | null } | null };

export type UserSearchQueryVariables = Exact<{
  pageArgs?: InputMaybe<PaginationArgsInput>;
}>;


export type UserSearchQuery = { __typename?: 'Query', userSearch?: { __typename?: 'PaginatedUserAccounts', hasMore?: boolean | null, total?: number | null, items?: Array<{ __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null> | null } | null };

export type AdminUserSearchQueryVariables = Exact<{
  pageArgs?: InputMaybe<PaginationArgsInput>;
}>;


export type AdminUserSearchQuery = { __typename?: 'Query', adminUserSearch?: { __typename?: 'PaginatedUserAccountsForAdmin', hasMore?: boolean | null, total?: number | null, items?: Array<{ __typename?: 'UserAccountForAdmin', email?: string | null, offline_hash?: string | null, pro_status?: SubscriptionStatus | null, id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null> | null } | null };

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

export const MiniSolveFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MiniSolveFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Solve"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"raw_time"}},{"kind":"Field","name":{"kind":"Name","value":"cube_type"}},{"kind":"Field","name":{"kind":"Name","value":"session_id"}},{"kind":"Field","name":{"kind":"Name","value":"trainer_name"}},{"kind":"Field","name":{"kind":"Name","value":"bulk"}},{"kind":"Field","name":{"kind":"Name","value":"scramble"}},{"kind":"Field","name":{"kind":"Name","value":"from_timer"}},{"kind":"Field","name":{"kind":"Name","value":"training_session_id"}},{"kind":"Field","name":{"kind":"Name","value":"dnf"}},{"kind":"Field","name":{"kind":"Name","value":"plus_two"}},{"kind":"Field","name":{"kind":"Name","value":"is_smart_cube"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"started_at"}},{"kind":"Field","name":{"kind":"Name","value":"ended_at"}}]}}]} as unknown as DocumentNode<MiniSolveFragmentFragment, unknown>;
export const StatsFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"StatsFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Stats"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"friend_count"}},{"kind":"Field","name":{"kind":"Name","value":"matches_played"}},{"kind":"Field","name":{"kind":"Name","value":"matches_won"}},{"kind":"Field","name":{"kind":"Name","value":"profile_views"}},{"kind":"Field","name":{"kind":"Name","value":"match_max_win_streak"}},{"kind":"Field","name":{"kind":"Name","value":"match_solve_count"}},{"kind":"Field","name":{"kind":"Name","value":"solve_views"}}]}}]} as unknown as DocumentNode<StatsFragmentFragment, unknown>;
export const StatsModuleBlockFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"StatsModuleBlockFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"StatsModuleBlock"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"statType"}},{"kind":"Field","name":{"kind":"Name","value":"sortBy"}},{"kind":"Field","name":{"kind":"Name","value":"session"}},{"kind":"Field","name":{"kind":"Name","value":"colorName"}},{"kind":"Field","name":{"kind":"Name","value":"averageCount"}}]}}]} as unknown as DocumentNode<StatsModuleBlockFragmentFragment, unknown>;
export const AlgorithmOverrideFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AlgorithmOverrideFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AlgorithmOverride"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cube_key"}},{"kind":"Field","name":{"kind":"Name","value":"rotate"}},{"kind":"Field","name":{"kind":"Name","value":"solution"}}]}}]} as unknown as DocumentNode<AlgorithmOverrideFragmentFragment, unknown>;
export const TrainerFavoriteFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TrainerFavoriteFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TrainerFavorite"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cube_key"}}]}}]} as unknown as DocumentNode<TrainerFavoriteFragmentFragment, unknown>;
export const TrainerAlgorithmFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TrainerAlgorithmFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TrainerAlgorithm"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"scrambles"}},{"kind":"Field","name":{"kind":"Name","value":"solution"}},{"kind":"Field","name":{"kind":"Name","value":"pro_only"}},{"kind":"Field","name":{"kind":"Name","value":"cube_type"}},{"kind":"Field","name":{"kind":"Name","value":"algo_type"}},{"kind":"Field","name":{"kind":"Name","value":"colors"}},{"kind":"Field","name":{"kind":"Name","value":"group_name"}}]}}]} as unknown as DocumentNode<TrainerAlgorithmFragmentFragment, unknown>;
export const SessionFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SessionFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Session"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"order"}}]}}]} as unknown as DocumentNode<SessionFragmentFragment, unknown>;
export const EloRatingFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EloRatingFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"EloRating"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"user_id"}},{"kind":"Field","name":{"kind":"Name","value":"profile_id"}},{"kind":"Field","name":{"kind":"Name","value":"elo_overall_rating"}},{"kind":"Field","name":{"kind":"Name","value":"games_overall_count"}},{"kind":"Field","name":{"kind":"Name","value":"elo_222_rating"}},{"kind":"Field","name":{"kind":"Name","value":"games_222_count"}},{"kind":"Field","name":{"kind":"Name","value":"elo_333_rating"}},{"kind":"Field","name":{"kind":"Name","value":"games_333_count"}},{"kind":"Field","name":{"kind":"Name","value":"elo_444_rating"}},{"kind":"Field","name":{"kind":"Name","value":"games_444_count"}},{"kind":"Field","name":{"kind":"Name","value":"updated_at"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}}]} as unknown as DocumentNode<EloRatingFragmentFragment, unknown>;
export const ImageFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ImageFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Image"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"user_id"}},{"kind":"Field","name":{"kind":"Name","value":"storage_path"}}]}}]} as unknown as DocumentNode<ImageFragmentFragment, unknown>;
export const PublicUserFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PublicUserFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"IPublicUserAccount"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"verified"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"banned_forever"}},{"kind":"Field","name":{"kind":"Name","value":"is_pro"}},{"kind":"Field","name":{"kind":"Name","value":"banned_until"}},{"kind":"Field","name":{"kind":"Name","value":"admin"}},{"kind":"Field","name":{"kind":"Name","value":"mod"}},{"kind":"Field","name":{"kind":"Name","value":"integrations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"service_name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"profile"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pfp_image"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ImageFragment"}}]}}]}}]}}]} as unknown as DocumentNode<PublicUserFragmentFragment, unknown>;
export const EloRatingWithUserFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EloRatingWithUserFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"EloRating"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"EloRatingFragment"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserFragment"}}]}}]}}]} as unknown as DocumentNode<EloRatingWithUserFragmentFragment, unknown>;
export const UserAccountFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UserAccountFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"IUserAccount"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserFragment"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"offline_hash"}},{"kind":"Field","name":{"kind":"Name","value":"pro_status"}}]}}]} as unknown as DocumentNode<UserAccountFragmentFragment, unknown>;
export const SolveFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SolveFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Solve"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"raw_time"}},{"kind":"Field","name":{"kind":"Name","value":"cube_type"}},{"kind":"Field","name":{"kind":"Name","value":"user_id"}},{"kind":"Field","name":{"kind":"Name","value":"scramble"}},{"kind":"Field","name":{"kind":"Name","value":"session_id"}},{"kind":"Field","name":{"kind":"Name","value":"started_at"}},{"kind":"Field","name":{"kind":"Name","value":"ended_at"}},{"kind":"Field","name":{"kind":"Name","value":"dnf"}},{"kind":"Field","name":{"kind":"Name","value":"plus_two"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"is_smart_cube"}},{"kind":"Field","name":{"kind":"Name","value":"smart_turn_count"}},{"kind":"Field","name":{"kind":"Name","value":"share_code"}},{"kind":"Field","name":{"kind":"Name","value":"smart_turns"}},{"kind":"Field","name":{"kind":"Name","value":"smart_put_down_time"}},{"kind":"Field","name":{"kind":"Name","value":"inspection_time"}},{"kind":"Field","name":{"kind":"Name","value":"smart_device"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"internal_name"}},{"kind":"Field","name":{"kind":"Name","value":"device_id"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solve_method_steps"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"turn_count"}},{"kind":"Field","name":{"kind":"Name","value":"turns"}},{"kind":"Field","name":{"kind":"Name","value":"total_time"}},{"kind":"Field","name":{"kind":"Name","value":"tps"}},{"kind":"Field","name":{"kind":"Name","value":"recognition_time"}},{"kind":"Field","name":{"kind":"Name","value":"oll_case_key"}},{"kind":"Field","name":{"kind":"Name","value":"pll_case_key"}},{"kind":"Field","name":{"kind":"Name","value":"skipped"}},{"kind":"Field","name":{"kind":"Name","value":"parent_name"}},{"kind":"Field","name":{"kind":"Name","value":"method_name"}},{"kind":"Field","name":{"kind":"Name","value":"step_index"}},{"kind":"Field","name":{"kind":"Name","value":"step_name"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}}]}}]} as unknown as DocumentNode<SolveFragmentFragment, unknown>;
export const PublicUserWithEloFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PublicUserWithEloFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"IPublicUserAccount"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserFragment"}},{"kind":"Field","name":{"kind":"Name","value":"elo_rating"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"EloRatingFragment"}}]}}]}}]} as unknown as DocumentNode<PublicUserWithEloFragmentFragment, unknown>;
export const SolveWithUserFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SolveWithUserFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Solve"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SolveFragment"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserWithEloFragment"}}]}}]}}]} as unknown as DocumentNode<SolveWithUserFragmentFragment, unknown>;
export const FriendshipFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"FriendshipFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Friendship"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"user_id"}},{"kind":"Field","name":{"kind":"Name","value":"other_user_id"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserWithEloFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"other_user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserWithEloFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}}]} as unknown as DocumentNode<FriendshipFragmentFragment, unknown>;
export const FriendshipRequestFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"FriendshipRequestFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FriendshipRequest"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"from_id"}},{"kind":"Field","name":{"kind":"Name","value":"to_id"}},{"kind":"Field","name":{"kind":"Name","value":"accepted"}},{"kind":"Field","name":{"kind":"Name","value":"from_user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserWithEloFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"to_user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserWithEloFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}}]} as unknown as DocumentNode<FriendshipRequestFragmentFragment, unknown>;
export const NotificationFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"NotificationFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Notification"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"user_id"}},{"kind":"Field","name":{"kind":"Name","value":"notification_type"}},{"kind":"Field","name":{"kind":"Name","value":"notification_category_name"}},{"kind":"Field","name":{"kind":"Name","value":"triggering_user_id"}},{"kind":"Field","name":{"kind":"Name","value":"in_app_message"}},{"kind":"Field","name":{"kind":"Name","value":"read_at"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"icon"}},{"kind":"Field","name":{"kind":"Name","value":"link"}},{"kind":"Field","name":{"kind":"Name","value":"link_text"}},{"kind":"Field","name":{"kind":"Name","value":"subject"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"triggering_user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserWithEloFragment"}}]}}]}}]} as unknown as DocumentNode<NotificationFragmentFragment, unknown>;
export const EloLogFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EloLogFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"EloLog"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"player_id"}},{"kind":"Field","name":{"kind":"Name","value":"player_new_game_count"}},{"kind":"Field","name":{"kind":"Name","value":"opponent_id"}},{"kind":"Field","name":{"kind":"Name","value":"opponent_new_game_count"}},{"kind":"Field","name":{"kind":"Name","value":"cube_type"}},{"kind":"Field","name":{"kind":"Name","value":"match_id"}},{"kind":"Field","name":{"kind":"Name","value":"elo_change"}},{"kind":"Field","name":{"kind":"Name","value":"player_new_elo_rating"}},{"kind":"Field","name":{"kind":"Name","value":"opponent_new_elo_rating"}},{"kind":"Field","name":{"kind":"Name","value":"updated_at"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}}]} as unknown as DocumentNode<EloLogFragmentFragment, unknown>;
export const ChatMessageFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ChatMessageFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChatMessage"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserWithEloFragment"}}]}}]}}]} as unknown as DocumentNode<ChatMessageFragmentFragment, unknown>;
export const GameOptionsFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"GameOptionsFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"GameOptions"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"cube_type"}},{"kind":"Field","name":{"kind":"Name","value":"game_session_id"}},{"kind":"Field","name":{"kind":"Name","value":"game_type"}},{"kind":"Field","name":{"kind":"Name","value":"elimination_percent_change_rate"}},{"kind":"Field","name":{"kind":"Name","value":"elimination_starting_time_seconds"}},{"kind":"Field","name":{"kind":"Name","value":"gauntlet_time_multiplier"}},{"kind":"Field","name":{"kind":"Name","value":"head_to_head_target_win_count"}},{"kind":"Field","name":{"kind":"Name","value":"match_session_id"}}]}}]} as unknown as DocumentNode<GameOptionsFragmentFragment, unknown>;
export const MatchSessionFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MatchSessionFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MatchSession"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"match_type"}},{"kind":"Field","name":{"kind":"Name","value":"custom_match"}},{"kind":"Field","name":{"kind":"Name","value":"created_by_id"}},{"kind":"Field","name":{"kind":"Name","value":"min_players"}},{"kind":"Field","name":{"kind":"Name","value":"max_players"}},{"kind":"Field","name":{"kind":"Name","value":"chat_messages"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ChatMessageFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"game_options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"GameOptionsFragment"}}]}}]}}]} as unknown as DocumentNode<MatchSessionFragmentFragment, unknown>;
export const MatchParticipantFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MatchParticipantFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MatchParticipant"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"user_id"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"forfeited"}},{"kind":"Field","name":{"kind":"Name","value":"lost"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"resigned"}},{"kind":"Field","name":{"kind":"Name","value":"won"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserWithEloFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solves"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SolveFragment"}}]}}]}}]} as unknown as DocumentNode<MatchParticipantFragmentFragment, unknown>;
export const MatchFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MatchFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Match"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"link_code"}},{"kind":"Field","name":{"kind":"Name","value":"spectate_code"}},{"kind":"Field","name":{"kind":"Name","value":"ended_at"}},{"kind":"Field","name":{"kind":"Name","value":"started_at"}},{"kind":"Field","name":{"kind":"Name","value":"winner_id"}},{"kind":"Field","name":{"kind":"Name","value":"aborted"}},{"kind":"Field","name":{"kind":"Name","value":"match_session_id"}},{"kind":"Field","name":{"kind":"Name","value":"elo_log"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"EloLogFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"match_session"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MatchSessionFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"participants"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MatchParticipantFragment"}}]}}]}}]} as unknown as DocumentNode<MatchFragmentFragment, unknown>;
export const TopSolveFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TopSolveFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TopSolve"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"cube_type"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"solve"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SolveFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserWithEloFragment"}}]}}]}}]} as unknown as DocumentNode<TopSolveFragmentFragment, unknown>;
export const TopAverageFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TopAverageFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TopAverage"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"cube_type"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"solve_1"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SolveFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solve_2"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SolveFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solve_3"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SolveFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solve_4"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SolveFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solve_5"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SolveFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserWithEloFragment"}}]}}]}}]} as unknown as DocumentNode<TopAverageFragmentFragment, unknown>;
export const ProfileFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ProfileFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Profile"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}},{"kind":"Field","name":{"kind":"Name","value":"three_method"}},{"kind":"Field","name":{"kind":"Name","value":"three_goal"}},{"kind":"Field","name":{"kind":"Name","value":"main_three_cube"}},{"kind":"Field","name":{"kind":"Name","value":"favorite_event"}},{"kind":"Field","name":{"kind":"Name","value":"youtube_link"}},{"kind":"Field","name":{"kind":"Name","value":"twitter_link"}},{"kind":"Field","name":{"kind":"Name","value":"user_id"}},{"kind":"Field","name":{"kind":"Name","value":"reddit_link"}},{"kind":"Field","name":{"kind":"Name","value":"twitch_link"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserWithEloFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"top_solves"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"TopSolveFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"top_averages"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"TopAverageFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"header_image"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ImageFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pfp_image"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ImageFragment"}}]}}]}}]} as unknown as DocumentNode<ProfileFragmentFragment, unknown>;
export const GameSessionFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"GameSessionFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"GameSession"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"match"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"winner_id"}},{"kind":"Field","name":{"kind":"Name","value":"started_at"}},{"kind":"Field","name":{"kind":"Name","value":"ended_at"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"participants"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"user_id"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"resigned"}},{"kind":"Field","name":{"kind":"Name","value":"forfeited"}},{"kind":"Field","name":{"kind":"Name","value":"won"}},{"kind":"Field","name":{"kind":"Name","value":"lost"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserWithEloFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solves"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SolveFragment"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"match_session"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min_players"}},{"kind":"Field","name":{"kind":"Name","value":"max_players"}},{"kind":"Field","name":{"kind":"Name","value":"match_type"}},{"kind":"Field","name":{"kind":"Name","value":"custom_match"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solves"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SolveFragment"}}]}}]}}]} as unknown as DocumentNode<GameSessionFragmentFragment, unknown>;
export const IntegrationFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"IntegrationFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Integration"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"auth_expires_at"}},{"kind":"Field","name":{"kind":"Name","value":"service_name"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}}]} as unknown as DocumentNode<IntegrationFragmentFragment, unknown>;
export const MembershipPricingFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MembershipPricingFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MembershipPricing"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"unit_amount"}},{"kind":"Field","name":{"kind":"Name","value":"interval_count"}},{"kind":"Field","name":{"kind":"Name","value":"interval"}}]}}]} as unknown as DocumentNode<MembershipPricingFragmentFragment, unknown>;
export const MembershipFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MembershipFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Membership"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"canceled_at"}},{"kind":"Field","name":{"kind":"Name","value":"ended_at"}},{"kind":"Field","name":{"kind":"Name","value":"days_until_due"}},{"kind":"Field","name":{"kind":"Name","value":"cancel_at_period_end"}},{"kind":"Field","name":{"kind":"Name","value":"current_period_end"}},{"kind":"Field","name":{"kind":"Name","value":"start_date"}},{"kind":"Field","name":{"kind":"Name","value":"pricing"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MembershipPricingFragment"}}]}}]}}]} as unknown as DocumentNode<MembershipFragmentFragment, unknown>;
export const MembershipOptionsFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MembershipOptionsFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MembershipOptions"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"month"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MembershipPricingFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"year"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MembershipPricingFragment"}}]}}]}}]} as unknown as DocumentNode<MembershipOptionsFragmentFragment, unknown>;
export const CustomTrainerFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"CustomTrainerFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"CustomTrainer"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"solution"}},{"kind":"Field","name":{"kind":"Name","value":"scrambles"}},{"kind":"Field","name":{"kind":"Name","value":"colors"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"alt_solutions"}},{"kind":"Field","name":{"kind":"Name","value":"group_name"}},{"kind":"Field","name":{"kind":"Name","value":"algo_type"}},{"kind":"Field","name":{"kind":"Name","value":"three_d"}},{"kind":"Field","name":{"kind":"Name","value":"cube_type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"copy_of_id"}},{"kind":"Field","name":{"kind":"Name","value":"copy_of"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}}]}}]}}]}}]} as unknown as DocumentNode<CustomTrainerFragmentFragment, unknown>;
export const PublicCustomTrainerRecordFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PublicCustomTrainerRecordFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"CustomTrainer"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"CustomTrainerFragment"}},{"kind":"Field","name":{"kind":"Name","value":"user_id"}},{"kind":"Field","name":{"kind":"Name","value":"like_count"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"profile"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pfp_image"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ImageFragment"}}]}}]}}]}}]}}]} as unknown as DocumentNode<PublicCustomTrainerRecordFragmentFragment, unknown>;
export const TimerBackgroundFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TimerBackgroundFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TimerBackground"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"hex"}},{"kind":"Field","name":{"kind":"Name","value":"storage_path"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"url"}}]}}]} as unknown as DocumentNode<TimerBackgroundFragmentFragment, unknown>;
export const UserForMeFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UserForMeFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"IUserAccount"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"join_country"}},{"kind":"Field","name":{"kind":"Name","value":"timer_background"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"TimerBackgroundFragment"}}]}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserWithEloFragment"}}]}}]} as unknown as DocumentNode<UserForMeFragmentFragment, unknown>;
export const ReportFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ReportFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Report"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"reported_user_id"}},{"kind":"Field","name":{"kind":"Name","value":"created_by_id"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"resolved_at"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"created_by"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserWithEloFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"reported_user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserWithEloFragment"}}]}}]}}]} as unknown as DocumentNode<ReportFragmentFragment, unknown>;
export const CustomCubeTypeFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"CustomCubeTypeFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"CustomCubeType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"user_id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"scramble"}},{"kind":"Field","name":{"kind":"Name","value":"private"}}]}}]} as unknown as DocumentNode<CustomCubeTypeFragmentFragment, unknown>;
export const SettingsFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SettingsFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Setting"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"user_id"}},{"kind":"Field","name":{"kind":"Name","value":"focus_mode"}},{"kind":"Field","name":{"kind":"Name","value":"freeze_time"}},{"kind":"Field","name":{"kind":"Name","value":"inspection"}},{"kind":"Field","name":{"kind":"Name","value":"manual_entry"}},{"kind":"Field","name":{"kind":"Name","value":"inspection_delay"}},{"kind":"Field","name":{"kind":"Name","value":"session_id"}},{"kind":"Field","name":{"kind":"Name","value":"inverse_time_list"}},{"kind":"Field","name":{"kind":"Name","value":"hide_time_when_solving"}},{"kind":"Field","name":{"kind":"Name","value":"nav_collapsed"}},{"kind":"Field","name":{"kind":"Name","value":"timer_decimal_points"}},{"kind":"Field","name":{"kind":"Name","value":"pb_confetti"}},{"kind":"Field","name":{"kind":"Name","value":"play_inspection_sound"}},{"kind":"Field","name":{"kind":"Name","value":"zero_out_time_after_solve"}},{"kind":"Field","name":{"kind":"Name","value":"confirm_delete_solve"}},{"kind":"Field","name":{"kind":"Name","value":"use_space_with_smart_cube"}},{"kind":"Field","name":{"kind":"Name","value":"require_period_in_manual_time_entry"}},{"kind":"Field","name":{"kind":"Name","value":"beta_tester"}},{"kind":"Field","name":{"kind":"Name","value":"cube_type"}},{"kind":"Field","name":{"kind":"Name","value":"custom_cube_types"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"CustomCubeTypeFragment"}}]}}]}}]} as unknown as DocumentNode<SettingsFragmentFragment, unknown>;
export const NotificationPreferenceFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"NotificationPreferenceFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NotificationPreference"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"friend_request"}},{"kind":"Field","name":{"kind":"Name","value":"friend_request_accept"}},{"kind":"Field","name":{"kind":"Name","value":"marketing_emails"}},{"kind":"Field","name":{"kind":"Name","value":"elo_refund"}}]}}]} as unknown as DocumentNode<NotificationPreferenceFragmentFragment, unknown>;
export const UserAccountMatchesSummaryFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UserAccountMatchesSummaryFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"UserAccountMatchesSummary"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"count"}},{"kind":"Field","name":{"kind":"Name","value":"wins"}},{"kind":"Field","name":{"kind":"Name","value":"losses"}}]}}]} as unknown as DocumentNode<UserAccountMatchesSummaryFragmentFragment, unknown>;
export const UserAccountSolvesSummaryFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UserAccountSolvesSummaryFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"UserAccountSolvesSummary"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"count"}},{"kind":"Field","name":{"kind":"Name","value":"average"}},{"kind":"Field","name":{"kind":"Name","value":"min_time"}},{"kind":"Field","name":{"kind":"Name","value":"max_time"}},{"kind":"Field","name":{"kind":"Name","value":"sum"}},{"kind":"Field","name":{"kind":"Name","value":"cube_type"}}]}}]} as unknown as DocumentNode<UserAccountSolvesSummaryFragmentFragment, unknown>;
export const UserAccountSummaryFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UserAccountSummaryFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"UserAccountSummary"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"solves"}},{"kind":"Field","name":{"kind":"Name","value":"reports_for"}},{"kind":"Field","name":{"kind":"Name","value":"reports_created"}},{"kind":"Field","name":{"kind":"Name","value":"profile_views"}},{"kind":"Field","name":{"kind":"Name","value":"bans"}},{"kind":"Field","name":{"kind":"Name","value":"matches"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"UserAccountMatchesSummaryFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"match_solves"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"UserAccountSolvesSummaryFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"timer_solves"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"UserAccountSolvesSummaryFragment"}}]}}]}}]} as unknown as DocumentNode<UserAccountSummaryFragmentFragment, unknown>;
export const UserForAdminFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UserForAdminFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"UserAccountForAdmin"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserWithEloFragment"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"join_country"}},{"kind":"Field","name":{"kind":"Name","value":"join_ip"}},{"kind":"Field","name":{"kind":"Name","value":"reports_for"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ReportFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"settings"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SettingsFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"chat_messages"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ChatMessageFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"notification_preferences"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"NotificationPreferenceFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"summary"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"UserAccountSummaryFragment"}}]}}]}}]} as unknown as DocumentNode<UserForAdminFragmentFragment, unknown>;
export const ReportSummaryFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ReportSummaryFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ReportSummary"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"last_report"}},{"kind":"Field","name":{"kind":"Name","value":"first_report"}},{"kind":"Field","name":{"kind":"Name","value":"count"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserWithEloFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"reports"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ReportFragment"}}]}}]}}]} as unknown as DocumentNode<ReportSummaryFragmentFragment, unknown>;
export const DeleteFriendshipRequestDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"deleteFriendshipRequest"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"friendshipRequestId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteFriendshipRequest"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"friendshipRequestId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"friendshipRequestId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"FriendshipRequestFragment"}}]}}]}},...FriendshipRequestFragmentFragmentDoc.definitions,...PublicUserWithEloFragmentFragmentDoc.definitions,...PublicUserFragmentFragmentDoc.definitions,...ImageFragmentFragmentDoc.definitions,...EloRatingFragmentFragmentDoc.definitions]} as unknown as DocumentNode<DeleteFriendshipRequestMutation, DeleteFriendshipRequestMutationVariables>;
export const AcceptFriendshipRequestDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"acceptFriendshipRequest"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"friendshipRequestId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"acceptFriendshipRequest"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"friendshipRequestId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"friendshipRequestId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"FriendshipFragment"}}]}}]}},...FriendshipFragmentFragmentDoc.definitions,...PublicUserWithEloFragmentFragmentDoc.definitions,...PublicUserFragmentFragmentDoc.definitions,...ImageFragmentFragmentDoc.definitions,...EloRatingFragmentFragmentDoc.definitions]} as unknown as DocumentNode<AcceptFriendshipRequestMutation, AcceptFriendshipRequestMutationVariables>;
export const UnfriendDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"unfriend"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"targetUserId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"unfriend"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"targetUserId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"targetUserId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"FriendshipFragment"}}]}}]}},...FriendshipFragmentFragmentDoc.definitions,...PublicUserWithEloFragmentFragmentDoc.definitions,...PublicUserFragmentFragmentDoc.definitions,...ImageFragmentFragmentDoc.definitions,...EloRatingFragmentFragmentDoc.definitions]} as unknown as DocumentNode<UnfriendMutation, UnfriendMutationVariables>;
export const SendFriendshipRequestDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"sendFriendshipRequest"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"toUserId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sendFriendshipRequest"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"toUserId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"toUserId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"FriendshipRequestFragment"}}]}}]}},...FriendshipRequestFragmentFragmentDoc.definitions,...PublicUserWithEloFragmentFragmentDoc.definitions,...PublicUserFragmentFragmentDoc.definitions,...ImageFragmentFragmentDoc.definitions,...EloRatingFragmentFragmentDoc.definitions]} as unknown as DocumentNode<SendFriendshipRequestMutation, SendFriendshipRequestMutationVariables>;
export const MergeSessionsDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"mergeSessions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"oldSessionId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"newSessionId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mergeSessions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"oldSessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"oldSessionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"newSessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"newSessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SessionFragment"}}]}}]}},...SessionFragmentFragmentDoc.definitions]} as unknown as DocumentNode<MergeSessionsMutation, MergeSessionsMutationVariables>;
export const CreateSessionDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"createSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"SessionInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SessionFragment"}}]}}]}},...SessionFragmentFragmentDoc.definitions]} as unknown as DocumentNode<CreateSessionMutation, CreateSessionMutationVariables>;
export const UpdateSessionDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"updateSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"SessionInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SessionFragment"}}]}}]}},...SessionFragmentFragmentDoc.definitions]} as unknown as DocumentNode<UpdateSessionMutation, UpdateSessionMutationVariables>;
export const DeleteSessionDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"deleteSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SessionFragment"}}]}}]}},...SessionFragmentFragmentDoc.definitions]} as unknown as DocumentNode<DeleteSessionMutation, DeleteSessionMutationVariables>;
export const ReorderSessionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"reorderSessions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ids"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"reorderSessions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"ids"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ids"}}}]}]}}]} as unknown as DocumentNode<ReorderSessionsMutation, ReorderSessionsMutationVariables>;
export const CreateAnnouncementDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"createAnnouncement"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateAnnouncementInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createAnnouncement"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"isDraft"}}]}}]}}]} as unknown as DocumentNode<CreateAnnouncementMutation, CreateAnnouncementMutationVariables>;
export const UpdateAnnouncementDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"updateAnnouncement"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateAnnouncementInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateAnnouncement"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"isDraft"}}]}}]}}]} as unknown as DocumentNode<UpdateAnnouncementMutation, UpdateAnnouncementMutationVariables>;
export const MarkAnnouncementAsViewedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"markAnnouncementAsViewed"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"announcementId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"markAnnouncementAsViewed"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"announcementId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"announcementId"}}}]}]}}]} as unknown as DocumentNode<MarkAnnouncementAsViewedMutation, MarkAnnouncementAsViewedMutationVariables>;
export const DeleteAnnouncementDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"deleteAnnouncement"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteAnnouncement"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<DeleteAnnouncementMutation, DeleteAnnouncementMutationVariables>;
export const ReceivedFriendshipRequestsFromUserDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"receivedFriendshipRequestsFromUser"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"receivedFriendshipRequestsFromUser"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"userId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"FriendshipRequestFragment"}}]}}]}},...FriendshipRequestFragmentFragmentDoc.definitions,...PublicUserWithEloFragmentFragmentDoc.definitions,...PublicUserFragmentFragmentDoc.definitions,...ImageFragmentFragmentDoc.definitions,...EloRatingFragmentFragmentDoc.definitions]} as unknown as DocumentNode<ReceivedFriendshipRequestsFromUserQuery, ReceivedFriendshipRequestsFromUserQueryVariables>;
export const SentFriendshipRequestsToUserDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"sentFriendshipRequestsToUser"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sentFriendshipRequestsToUser"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"userId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"FriendshipRequestFragment"}}]}}]}},...FriendshipRequestFragmentFragmentDoc.definitions,...PublicUserWithEloFragmentFragmentDoc.definitions,...PublicUserFragmentFragmentDoc.definitions,...ImageFragmentFragmentDoc.definitions,...EloRatingFragmentFragmentDoc.definitions]} as unknown as DocumentNode<SentFriendshipRequestsToUserQuery, SentFriendshipRequestsToUserQueryVariables>;
export const SolveByShareCodeDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"solveByShareCode"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"shareCode"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"solveByShareCode"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"shareCode"},"value":{"kind":"Variable","name":{"kind":"Name","value":"shareCode"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SolveWithUserFragment"}}]}}]}},...SolveWithUserFragmentFragmentDoc.definitions,...SolveFragmentFragmentDoc.definitions,...PublicUserWithEloFragmentFragmentDoc.definitions,...PublicUserFragmentFragmentDoc.definitions,...ImageFragmentFragmentDoc.definitions,...EloRatingFragmentFragmentDoc.definitions]} as unknown as DocumentNode<SolveByShareCodeQuery, SolveByShareCodeQueryVariables>;
export const ProfileDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"profile"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"username"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"profile"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"username"},"value":{"kind":"Variable","name":{"kind":"Name","value":"username"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ProfileFragment"}}]}}]}},...ProfileFragmentFragmentDoc.definitions,...PublicUserWithEloFragmentFragmentDoc.definitions,...PublicUserFragmentFragmentDoc.definitions,...ImageFragmentFragmentDoc.definitions,...EloRatingFragmentFragmentDoc.definitions,...TopSolveFragmentFragmentDoc.definitions,...SolveFragmentFragmentDoc.definitions,...TopAverageFragmentFragmentDoc.definitions]} as unknown as DocumentNode<ProfileQuery, ProfileQueryVariables>;
export const EloLeaderboardsDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"eloLeaderboards"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pageArgs"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"PaginationArgsInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"eloLeaderboards"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"pageArgs"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pageArgs"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasMore"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"EloRatingWithUserFragment"}}]}}]}}]}},...EloRatingWithUserFragmentFragmentDoc.definitions,...EloRatingFragmentFragmentDoc.definitions,...PublicUserFragmentFragmentDoc.definitions,...ImageFragmentFragmentDoc.definitions]} as unknown as DocumentNode<EloLeaderboardsQuery, EloLeaderboardsQueryVariables>;
export const UserSearchDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"userSearch"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pageArgs"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"PaginationArgsInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userSearch"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"pageArgs"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pageArgs"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasMore"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserFragment"}}]}}]}}]}},...PublicUserFragmentFragmentDoc.definitions,...ImageFragmentFragmentDoc.definitions]} as unknown as DocumentNode<UserSearchQuery, UserSearchQueryVariables>;
export const AdminUserSearchDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"adminUserSearch"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pageArgs"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"PaginationArgsInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"adminUserSearch"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"pageArgs"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pageArgs"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasMore"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"UserAccountFragment"}}]}}]}}]}},...UserAccountFragmentFragmentDoc.definitions,...PublicUserFragmentFragmentDoc.definitions,...ImageFragmentFragmentDoc.definitions]} as unknown as DocumentNode<AdminUserSearchQuery, AdminUserSearchQueryVariables>;
export const GetActiveAnnouncementsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"getActiveAnnouncements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getActiveAnnouncements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"hasViewed"}}]}}]}}]} as unknown as DocumentNode<GetActiveAnnouncementsQuery, GetActiveAnnouncementsQueryVariables>;
export const GetUnreadAnnouncementCountDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"getUnreadAnnouncementCount"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getUnreadAnnouncementCount"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"count"}}]}}]}}]} as unknown as DocumentNode<GetUnreadAnnouncementCountQuery, GetUnreadAnnouncementCountQueryVariables>;
export const GetAllAnnouncementsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"getAllAnnouncements"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"AnnouncementFilterInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getAllAnnouncements"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"isDraft"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"viewCount"}}]}}]}}]} as unknown as DocumentNode<GetAllAnnouncementsQuery, GetAllAnnouncementsQueryVariables>;
export const GetMyAnnouncementHistoryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"getMyAnnouncementHistory"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"offset"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getMyAnnouncementHistory"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}},{"kind":"Argument","name":{"kind":"Name","value":"offset"},"value":{"kind":"Variable","name":{"kind":"Name","value":"offset"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<GetMyAnnouncementHistoryQuery, GetMyAnnouncementHistoryQueryVariables>;