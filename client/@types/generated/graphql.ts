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

export type ActiveUserRow = {
  __typename?: 'ActiveUserRow';
  active_minutes?: Maybe<Scalars['Int']>;
  last_seen_at?: Maybe<Scalars['DateTime']>;
  user?: Maybe<PublicUserAccount>;
};

export type ActivityHeartbeatResult = {
  __typename?: 'ActivityHeartbeatResult';
  success?: Maybe<Scalars['Boolean']>;
};

export type AdminActiveUsersResult = {
  __typename?: 'AdminActiveUsersResult';
  available_months?: Maybe<Array<Maybe<Scalars['String']>>>;
  rows?: Maybe<Array<Maybe<ActiveUserRow>>>;
  total_active_minutes?: Maybe<Scalars['Int']>;
  total_active_users?: Maybe<Scalars['Int']>;
};

export type AdminBattleMatchPage = {
  __typename?: 'AdminBattleMatchPage';
  hasMore?: Maybe<Scalars['Boolean']>;
  items?: Maybe<Array<Maybe<AdminBattleMatchRow>>>;
  total?: Maybe<Scalars['Int']>;
};

export type AdminBattleMatchRow = {
  __typename?: 'AdminBattleMatchRow';
  end_reason?: Maybe<Scalars['String']>;
  ended_at?: Maybe<Scalars['DateTime']>;
  flags?: Maybe<Array<Maybe<Scalars['String']>>>;
  id?: Maybe<Scalars['String']>;
  is_challenge?: Maybe<Scalars['Boolean']>;
  player_a?: Maybe<BattlePlayer>;
  player_b?: Maybe<BattlePlayer>;
  puzzle?: Maybe<Scalars['String']>;
  rated?: Maybe<Scalars['Boolean']>;
  rounds_a?: Maybe<Scalars['Int']>;
  rounds_b?: Maybe<Scalars['Int']>;
  status?: Maybe<Scalars['String']>;
  voided_at?: Maybe<Scalars['DateTime']>;
  winner?: Maybe<Scalars['String']>;
};

export type AdminCubeCalibrationRow = {
  __typename?: 'AdminCubeCalibrationRow';
  algo_version?: Maybe<Scalars['Int']>;
  app_version?: Maybe<Scalars['String']>;
  created_at?: Maybe<Scalars['DateTime']>;
  cube_brand?: Maybe<Scalars['String']>;
  cube_id?: Maybe<Scalars['String']>;
  cube_name?: Maybe<Scalars['String']>;
  current_far_max_ut?: Maybe<Scalars['Float']>;
  current_near_min_ut?: Maybe<Scalars['Float']>;
  current_quality?: Maybe<Scalars['String']>;
  device_model?: Maybe<Scalars['String']>;
  email?: Maybe<Scalars['String']>;
  far_max_ut?: Maybe<Scalars['Float']>;
  id?: Maybe<Scalars['String']>;
  measured_at?: Maybe<Scalars['DateTime']>;
  near_min_ut?: Maybe<Scalars['Float']>;
  noise_ut?: Maybe<Scalars['Float']>;
  noisy?: Maybe<Scalars['Boolean']>;
  os_version?: Maybe<Scalars['String']>;
  peak_ut?: Maybe<Scalars['Float']>;
  platform?: Maybe<Scalars['String']>;
  puzzle?: Maybe<Scalars['String']>;
  puzzle_name?: Maybe<Scalars['String']>;
  quality?: Maybe<Scalars['String']>;
  rate_hz?: Maybe<Scalars['Float']>;
  rest_ut?: Maybe<Scalars['Float']>;
  sample_count?: Maybe<Scalars['Int']>;
  sensor_name?: Maybe<Scalars['String']>;
  sweep_ms?: Maybe<Scalars['Int']>;
  updated_at?: Maybe<Scalars['DateTime']>;
  user_id?: Maybe<Scalars['String']>;
  username?: Maybe<Scalars['String']>;
};

export type AdminCubeCalibrationSummary = {
  __typename?: 'AdminCubeCalibrationSummary';
  calibrations?: Maybe<Scalars['Int']>;
  device_model?: Maybe<Scalars['String']>;
  distinct_users?: Maybe<Scalars['Int']>;
  median_noise_ut?: Maybe<Scalars['Float']>;
  median_peak_ut?: Maybe<Scalars['Float']>;
  median_rest_ut?: Maybe<Scalars['Float']>;
  p10_rest_ut?: Maybe<Scalars['Float']>;
  platform?: Maybe<Scalars['String']>;
  puzzle?: Maybe<Scalars['String']>;
  telemetry_lifts?: Maybe<Scalars['Int']>;
  telemetry_median_near_ut?: Maybe<Scalars['Float']>;
  telemetry_placements?: Maybe<Scalars['Int']>;
  telemetry_rejects?: Maybe<Scalars['Int']>;
  weak_ratio?: Maybe<Scalars['Float']>;
};

export type AdminDashboardStats = {
  __typename?: 'AdminDashboardStats';
  app_version?: Maybe<Scalars['String']>;
  build_sha?: Maybe<Scalars['String']>;
  dau?: Maybe<Scalars['Int']>;
  mau?: Maybe<Scalars['Int']>;
  online_users?: Maybe<Scalars['Int']>;
  pending_reports_count?: Maybe<Scalars['Int']>;
  pending_support_tickets_count?: Maybe<Scalars['Int']>;
  pro_users_count?: Maybe<Scalars['Int']>;
  signups_today?: Maybe<Scalars['Int']>;
  signups_week?: Maybe<Scalars['Int']>;
  solves_today?: Maybe<Scalars['Int']>;
  solves_total?: Maybe<Scalars['Int']>;
  solves_week?: Maybe<Scalars['Int']>;
  total_users?: Maybe<Scalars['Int']>;
  wau?: Maybe<Scalars['Int']>;
  wca_connected?: Maybe<Scalars['Int']>;
  zkt_connected?: Maybe<Scalars['Int']>;
};

export type AdminSendPushResult = {
  __typename?: 'AdminSendPushResult';
  success?: Maybe<Scalars['Boolean']>;
};

export type AdminUserFiltersInput = {
  admin?: InputMaybe<Scalars['Boolean']>;
  banned?: InputMaybe<Scalars['Boolean']>;
  email_verified?: InputMaybe<Scalars['Boolean']>;
  has_wca?: InputMaybe<Scalars['Boolean']>;
  has_zkt?: InputMaybe<Scalars['Boolean']>;
  is_pro?: InputMaybe<Scalars['Boolean']>;
  mod?: InputMaybe<Scalars['Boolean']>;
  platforms?: InputMaybe<Array<Scalars['String']>>;
  verified?: InputMaybe<Scalars['Boolean']>;
};

export enum AdminUserSortDirection {
  Asc = 'asc',
  Desc = 'desc'
}

export enum AdminUserSortField {
  CreatedAt = 'created_at',
  LastSeenAt = 'last_seen_at'
}

export type AdminUserSortInput = {
  direction?: InputMaybe<AdminUserSortDirection>;
  field?: InputMaybe<AdminUserSortField>;
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

export type AlgSet = {
  __typename?: 'AlgSet';
  categories?: Maybe<Array<Maybe<Scalars['String']>>>;
  code?: Maybe<Scalars['String']>;
  created_at?: Maybe<Scalars['DateTime']>;
  description?: Maybe<Scalars['String']>;
  hidden?: Maybe<Scalars['Boolean']>;
  id?: Maybe<Scalars['String']>;
  is_owner?: Maybe<Scalars['Boolean']>;
  is_saved?: Maybe<Scalars['Boolean']>;
  item_count?: Maybe<Scalars['Int']>;
  items?: Maybe<Array<Maybe<AlgSetItem>>>;
  name?: Maybe<Scalars['String']>;
  owner?: Maybe<AlgSetOwner>;
  preview?: Maybe<Array<Maybe<AlgSetItem>>>;
  published_at?: Maybe<Scalars['DateTime']>;
  puzzles?: Maybe<Array<Maybe<Scalars['String']>>>;
  save_count?: Maybe<Scalars['Int']>;
  updated_at?: Maybe<Scalars['DateTime']>;
  visibility?: Maybe<Scalars['String']>;
};

export type AlgSetCreateInput = {
  description?: InputMaybe<Scalars['String']>;
  name?: InputMaybe<Scalars['String']>;
  visibility?: InputMaybe<Scalars['String']>;
};

export type AlgSetItem = {
  __typename?: 'AlgSetItem';
  algorithm?: Maybe<Scalars['String']>;
  case_name?: Maybe<Scalars['String']>;
  category?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  position?: Maybe<Scalars['Int']>;
  puzzle?: Maybe<Scalars['String']>;
  subset?: Maybe<Scalars['String']>;
};

export type AlgSetItemInput = {
  algorithm?: InputMaybe<Scalars['String']>;
  case_name?: InputMaybe<Scalars['String']>;
  category?: InputMaybe<Scalars['String']>;
};

export type AlgSetOwner = {
  __typename?: 'AlgSetOwner';
  avatar_path?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  username?: Maybe<Scalars['String']>;
  verified?: Maybe<Scalars['Boolean']>;
};

export type AlgSetSummary = {
  __typename?: 'AlgSetSummary';
  categories?: Maybe<Array<Maybe<Scalars['String']>>>;
  code?: Maybe<Scalars['String']>;
  created_at?: Maybe<Scalars['DateTime']>;
  description?: Maybe<Scalars['String']>;
  hidden?: Maybe<Scalars['Boolean']>;
  id?: Maybe<Scalars['String']>;
  item_count?: Maybe<Scalars['Int']>;
  name?: Maybe<Scalars['String']>;
  owner?: Maybe<AlgSetOwner>;
  preview?: Maybe<Array<Maybe<AlgSetItem>>>;
  published_at?: Maybe<Scalars['DateTime']>;
  puzzles?: Maybe<Array<Maybe<Scalars['String']>>>;
  save_count?: Maybe<Scalars['Int']>;
  updated_at?: Maybe<Scalars['DateTime']>;
  visibility?: Maybe<Scalars['String']>;
};

export type AlgSetUpdateInput = {
  description?: InputMaybe<Scalars['String']>;
  name?: InputMaybe<Scalars['String']>;
  visibility?: InputMaybe<Scalars['String']>;
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
  pushSentAt?: Maybe<Scalars['DateTime']>;
  pushSuccessCount?: Maybe<Scalars['Int']>;
  pushTargetCount?: Maybe<Scalars['Int']>;
  showInApp?: Maybe<Scalars['Boolean']>;
  targetUrl?: Maybe<Scalars['String']>;
  title?: Maybe<Scalars['String']>;
  translations?: Maybe<Scalars['String']>;
  viewCount?: Maybe<Scalars['Int']>;
};

export type AnnouncementFilterInput = {
  category?: InputMaybe<Scalars['String']>;
  isActive?: InputMaybe<Scalars['Boolean']>;
  isDraft?: InputMaybe<Scalars['Boolean']>;
};

export type BackfillResult = {
  __typename?: 'BackfillResult';
  error?: Maybe<Scalars['Int']>;
  filled?: Maybe<Scalars['Int']>;
  noWcaId?: Maybe<Scalars['Int']>;
  rateLimited?: Maybe<Scalars['Int']>;
  recordsError?: Maybe<Scalars['Int']>;
  recordsFilled?: Maybe<Scalars['Int']>;
  recordsTotal?: Maybe<Scalars['Int']>;
  revoked?: Maybe<Scalars['Int']>;
  tokenFailed?: Maybe<Scalars['Int']>;
  total?: Maybe<Scalars['Int']>;
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
  banned_user?: Maybe<PublicUserAccount>;
  banned_user_id?: Maybe<Scalars['String']>;
  created_at?: Maybe<Scalars['DateTime']>;
  created_by?: Maybe<PublicUserAccount>;
  created_by_id?: Maybe<Scalars['String']>;
  forever?: Maybe<Scalars['Boolean']>;
  id?: Maybe<Scalars['String']>;
  minutes?: Maybe<Scalars['Int']>;
  reason?: Maybe<Scalars['String']>;
};

export type BanUserInput = {
  delete_published_solves?: InputMaybe<Scalars['Boolean']>;
  minutes?: InputMaybe<Scalars['Int']>;
  reason?: InputMaybe<Scalars['String']>;
  user_id?: InputMaybe<Scalars['String']>;
};

export type BattleChallengeInfo = {
  __typename?: 'BattleChallengeInfo';
  code?: Maybe<Scalars['String']>;
  expires_at?: Maybe<Scalars['DateTime']>;
  for_you?: Maybe<Scalars['Boolean']>;
  from?: Maybe<BattlePlayer>;
  own?: Maybe<Scalars['Boolean']>;
  restricted?: Maybe<Scalars['Boolean']>;
  status?: Maybe<Scalars['String']>;
};

export type BattleHeadToHead = {
  __typename?: 'BattleHeadToHead';
  draws?: Maybe<Scalars['Int']>;
  losses?: Maybe<Scalars['Int']>;
  wins?: Maybe<Scalars['Int']>;
};

export type BattleLeaderboardPage = {
  __typename?: 'BattleLeaderboardPage';
  page?: Maybe<Scalars['Int']>;
  page_size?: Maybe<Scalars['Int']>;
  rows?: Maybe<Array<Maybe<BattleLeaderboardRow>>>;
  total_count?: Maybe<Scalars['Int']>;
};

export type BattleLeaderboardRow = {
  __typename?: 'BattleLeaderboardRow';
  draws?: Maybe<Scalars['Int']>;
  games?: Maybe<Scalars['Int']>;
  losses?: Maybe<Scalars['Int']>;
  pfp_image_url?: Maybe<Scalars['String']>;
  provisional?: Maybe<Scalars['Boolean']>;
  rank?: Maybe<Scalars['Int']>;
  rating?: Maybe<Scalars['Int']>;
  user_id?: Maybe<Scalars['String']>;
  username?: Maybe<Scalars['String']>;
  wins?: Maybe<Scalars['Int']>;
};

export type BattleMatchDetail = {
  __typename?: 'BattleMatchDetail';
  end_reason?: Maybe<Scalars['String']>;
  ended_at?: Maybe<Scalars['DateTime']>;
  flags?: Maybe<Array<Maybe<Scalars['String']>>>;
  id?: Maybe<Scalars['String']>;
  is_challenge?: Maybe<Scalars['Boolean']>;
  is_rematch?: Maybe<Scalars['Boolean']>;
  player_a?: Maybe<BattlePlayer>;
  player_b?: Maybe<BattlePlayer>;
  puzzle?: Maybe<Scalars['String']>;
  rated?: Maybe<Scalars['Boolean']>;
  rating_a_after?: Maybe<Scalars['Int']>;
  rating_a_before?: Maybe<Scalars['Int']>;
  rating_b_after?: Maybe<Scalars['Int']>;
  rating_b_before?: Maybe<Scalars['Int']>;
  rounds?: Maybe<Array<Maybe<BattleRoundDetail>>>;
  rounds_a?: Maybe<Scalars['Int']>;
  rounds_b?: Maybe<Scalars['Int']>;
  started_at?: Maybe<Scalars['DateTime']>;
  status?: Maybe<Scalars['String']>;
  viewer_side?: Maybe<Scalars['String']>;
  voided_at?: Maybe<Scalars['DateTime']>;
  winner?: Maybe<Scalars['String']>;
};

export type BattleMatchHistoryPage = {
  __typename?: 'BattleMatchHistoryPage';
  hasMore?: Maybe<Scalars['Boolean']>;
  items?: Maybe<Array<Maybe<BattleMatchSummary>>>;
  total?: Maybe<Scalars['Int']>;
};

export type BattleMatchSummary = {
  __typename?: 'BattleMatchSummary';
  delta?: Maybe<Scalars['Int']>;
  end_reason?: Maybe<Scalars['String']>;
  ended_at?: Maybe<Scalars['DateTime']>;
  id?: Maybe<Scalars['String']>;
  is_challenge?: Maybe<Scalars['Boolean']>;
  is_rematch?: Maybe<Scalars['Boolean']>;
  opponent?: Maybe<BattlePlayer>;
  puzzle?: Maybe<Scalars['String']>;
  rated?: Maybe<Scalars['Boolean']>;
  rating_after?: Maybe<Scalars['Int']>;
  rating_before?: Maybe<Scalars['Int']>;
  result?: Maybe<Scalars['String']>;
  score_against?: Maybe<Scalars['Int']>;
  score_for?: Maybe<Scalars['Int']>;
};

export type BattlePlayer = {
  __typename?: 'BattlePlayer';
  id?: Maybe<Scalars['String']>;
  pfp_image_url?: Maybe<Scalars['String']>;
  username?: Maybe<Scalars['String']>;
};

export type BattleRoundDetail = {
  __typename?: 'BattleRoundDetail';
  a_dnf_reason?: Maybe<Scalars['String']>;
  a_flags?: Maybe<Array<Maybe<Scalars['String']>>>;
  a_moves?: Maybe<Scalars['String']>;
  a_penalty?: Maybe<Scalars['String']>;
  a_time_ms?: Maybe<Scalars['Int']>;
  b_dnf_reason?: Maybe<Scalars['String']>;
  b_flags?: Maybe<Array<Maybe<Scalars['String']>>>;
  b_moves?: Maybe<Scalars['String']>;
  b_penalty?: Maybe<Scalars['String']>;
  b_time_ms?: Maybe<Scalars['Int']>;
  index?: Maybe<Scalars['Int']>;
  scramble?: Maybe<Scalars['String']>;
  winner?: Maybe<Scalars['String']>;
};

export type BlockedUser = {
  __typename?: 'BlockedUser';
  created_at?: Maybe<Scalars['DateTime']>;
  id?: Maybe<Scalars['String']>;
  user?: Maybe<PublicUserAccount>;
};

export type BulkArchiveResult = {
  __typename?: 'BulkArchiveResult';
  failed?: Maybe<Scalars['Int']>;
  failedIds?: Maybe<Array<Maybe<Scalars['String']>>>;
  imported?: Maybe<Scalars['Int']>;
  lastProcessedId?: Maybe<Scalars['String']>;
  skipped?: Maybe<Scalars['Int']>;
  total?: Maybe<Scalars['Int']>;
};

export type BulkEmailResult = {
  __typename?: 'BulkEmailResult';
  failCount?: Maybe<Scalars['Int']>;
  skippedCount?: Maybe<Scalars['Int']>;
  successCount?: Maybe<Scalars['Int']>;
};

export type CaseStat = {
  __typename?: 'CaseStat';
  averageTime?: Maybe<Scalars['Float']>;
  avgExecution?: Maybe<Scalars['Float']>;
  avgRecognition?: Maybe<Scalars['Float']>;
  avgTps?: Maybe<Scalars['Float']>;
  avgTurns?: Maybe<Scalars['Float']>;
  bestTime?: Maybe<Scalars['Float']>;
  caseKey?: Maybe<Scalars['String']>;
  caseName?: Maybe<Scalars['String']>;
  caseType?: Maybe<Scalars['String']>;
  count?: Maybe<Scalars['Int']>;
  lastSeenAt?: Maybe<Scalars['Float']>;
};

export type CommunityAlgSetPage = {
  __typename?: 'CommunityAlgSetPage';
  has_more?: Maybe<Scalars['Boolean']>;
  items?: Maybe<Array<Maybe<AlgSetSummary>>>;
  total?: Maybe<Scalars['Int']>;
};

export type CompetitionFollow = {
  __typename?: 'CompetitionFollow';
  competition_id?: Maybe<Scalars['String']>;
  created_at?: Maybe<Scalars['DateTime']>;
  followed_name?: Maybe<Scalars['String']>;
  followed_registrant_id?: Maybe<Scalars['Int']>;
  followed_wca_id?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
};

export type ConversationList = {
  __typename?: 'ConversationList';
  conversations?: Maybe<Array<Maybe<ConversationView>>>;
  more_results?: Maybe<Scalars['Boolean']>;
};

export type ConversationView = {
  __typename?: 'ConversationView';
  accepted?: Maybe<Scalars['Boolean']>;
  id?: Maybe<Scalars['String']>;
  last_message?: Maybe<Message>;
  last_message_at?: Maybe<Scalars['DateTime']>;
  muted?: Maybe<Scalars['Boolean']>;
  other_user?: Maybe<PublicUserAccount>;
  unread_count?: Maybe<Scalars['Int']>;
};

export type CreateAnnouncementInput = {
  category?: InputMaybe<Scalars['String']>;
  content?: InputMaybe<Scalars['String']>;
  imageUrl?: InputMaybe<Scalars['String']>;
  isDraft?: InputMaybe<Scalars['Boolean']>;
  notificationPlatforms?: InputMaybe<Array<Scalars['String']>>;
  priority?: InputMaybe<Scalars['Int']>;
  sendNotification?: InputMaybe<Scalars['Boolean']>;
  showInApp?: InputMaybe<Scalars['Boolean']>;
  targetUrl?: InputMaybe<Scalars['String']>;
  title?: InputMaybe<Scalars['String']>;
  translations?: InputMaybe<Scalars['String']>;
};

export type CreatePromoCodeInput = {
  code?: InputMaybe<Scalars['String']>;
  duration_minutes?: InputMaybe<Scalars['Int']>;
  max_uses?: InputMaybe<Scalars['Int']>;
  membership_type?: InputMaybe<Scalars['String']>;
};

export type Cube = {
  __typename?: 'Cube';
  archived_at?: Maybe<Scalars['DateTime']>;
  ble_device_id?: Maybe<Scalars['String']>;
  ble_name?: Maybe<Scalars['String']>;
  brand?: Maybe<Scalars['String']>;
  calibrations?: Maybe<Array<Maybe<CubeCalibration>>>;
  created_at?: Maybe<Scalars['DateTime']>;
  first_used_at?: Maybe<Scalars['DateTime']>;
  id?: Maybe<Scalars['String']>;
  is_smart?: Maybe<Scalars['Boolean']>;
  last_used_at?: Maybe<Scalars['DateTime']>;
  legacy_smart_device_ids?: Maybe<Array<Maybe<Scalars['String']>>>;
  name?: Maybe<Scalars['String']>;
  puzzle?: Maybe<Scalars['String']>;
  solve_count?: Maybe<Scalars['Int']>;
  updated_at?: Maybe<Scalars['DateTime']>;
};

export type CubeCalibration = {
  __typename?: 'CubeCalibration';
  algo_version?: Maybe<Scalars['Int']>;
  app_version?: Maybe<Scalars['String']>;
  created_at?: Maybe<Scalars['DateTime']>;
  cube_id?: Maybe<Scalars['String']>;
  device_model?: Maybe<Scalars['String']>;
  far_max_ut?: Maybe<Scalars['Float']>;
  id?: Maybe<Scalars['String']>;
  measured_at?: Maybe<Scalars['DateTime']>;
  near_min_ut?: Maybe<Scalars['Float']>;
  noise_ut?: Maybe<Scalars['Float']>;
  os_version?: Maybe<Scalars['String']>;
  peak_ut?: Maybe<Scalars['Float']>;
  platform?: Maybe<Scalars['String']>;
  quality?: Maybe<Scalars['String']>;
  rate_hz?: Maybe<Scalars['Float']>;
  rest_ut?: Maybe<Scalars['Float']>;
  sample_count?: Maybe<Scalars['Int']>;
  sensor_name?: Maybe<Scalars['String']>;
  sweep_ms?: Maybe<Scalars['Int']>;
  updated_at?: Maybe<Scalars['DateTime']>;
};

export type CubeCalibrationInput = {
  algo_version?: InputMaybe<Scalars['Int']>;
  app_version?: InputMaybe<Scalars['String']>;
  cube_id?: InputMaybe<Scalars['String']>;
  device_model?: InputMaybe<Scalars['String']>;
  far_max_ut?: InputMaybe<Scalars['Float']>;
  measured_at?: InputMaybe<Scalars['DateTime']>;
  near_min_ut?: InputMaybe<Scalars['Float']>;
  noise_ut?: InputMaybe<Scalars['Float']>;
  os_version?: InputMaybe<Scalars['String']>;
  peak_ut?: InputMaybe<Scalars['Float']>;
  platform?: InputMaybe<Scalars['String']>;
  quality?: InputMaybe<Scalars['String']>;
  rate_hz?: InputMaybe<Scalars['Float']>;
  rest_ut?: InputMaybe<Scalars['Float']>;
  sample_count?: InputMaybe<Scalars['Int']>;
  sensor_name?: InputMaybe<Scalars['String']>;
  sweep_ms?: InputMaybe<Scalars['Int']>;
};

export type CubeInput = {
  brand?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['String']>;
  is_smart?: InputMaybe<Scalars['Boolean']>;
  make_main?: InputMaybe<Scalars['Boolean']>;
  name?: InputMaybe<Scalars['String']>;
  puzzle?: InputMaybe<Scalars['String']>;
  set_at?: InputMaybe<Scalars['DateTime']>;
};

export type CubeMain = {
  __typename?: 'CubeMain';
  cube_id?: Maybe<Scalars['String']>;
  puzzle?: Maybe<Scalars['String']>;
  set_at?: Maybe<Scalars['DateTime']>;
};

export type CubeUpdateInput = {
  brand?: InputMaybe<Scalars['String']>;
  is_smart?: InputMaybe<Scalars['Boolean']>;
  name?: InputMaybe<Scalars['String']>;
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
  key: Scalars['String'];
  name: Scalars['String'];
  private?: InputMaybe<Scalars['Boolean']>;
  scrambles?: InputMaybe<Scalars['String']>;
  solution: Scalars['String'];
  three_d?: InputMaybe<Scalars['Boolean']>;
};

export type DailyGoalReminderResult = {
  __typename?: 'DailyGoalReminderResult';
  count_room_solves?: Maybe<Scalars['Boolean']>;
  enabled?: Maybe<Scalars['Boolean']>;
};

export type DailyGoalType = {
  __typename?: 'DailyGoalType';
  cube_type?: Maybe<Scalars['String']>;
  enabled?: Maybe<Scalars['Boolean']>;
  id?: Maybe<Scalars['String']>;
  scramble_subset?: Maybe<Scalars['String']>;
  target?: Maybe<Scalars['Int']>;
};

/** Who may start a new conversation with this user */
export enum DmPolicy {
  Everyone = 'EVERYONE',
  Known = 'KNOWN',
  Nobody = 'NOBODY'
}

export type FeatureOverrideEntry = {
  __typename?: 'FeatureOverrideEntry';
  feature?: Maybe<Scalars['String']>;
  mode?: Maybe<Scalars['String']>;
  users?: Maybe<Array<Maybe<FeatureOverrideUser>>>;
};

export type FeatureOverrideEntryInput = {
  feature?: InputMaybe<Scalars['String']>;
  mode?: InputMaybe<Scalars['String']>;
  users?: InputMaybe<Array<FeatureOverrideUserInput>>;
};

export type FeatureOverrideUser = {
  __typename?: 'FeatureOverrideUser';
  id?: Maybe<Scalars['String']>;
  username?: Maybe<Scalars['String']>;
};

export type FeatureOverrideUserInput = {
  id?: InputMaybe<Scalars['String']>;
  username?: InputMaybe<Scalars['String']>;
};

export type File = {
  __typename?: 'File';
  encoding: Scalars['String'];
  filename: Scalars['String'];
  mimetype: Scalars['String'];
};

export type FollowCompetitorInput = {
  competition_id?: InputMaybe<Scalars['String']>;
  name?: InputMaybe<Scalars['String']>;
  registrant_id?: InputMaybe<Scalars['Int']>;
  wca_id?: InputMaybe<Scalars['String']>;
};

export type IapStatus = {
  __typename?: 'IapStatus';
  can_purchase?: Maybe<Scalars['Boolean']>;
  iap_billing_issue_at?: Maybe<Scalars['DateTime']>;
  iap_cancellation_at?: Maybe<Scalars['DateTime']>;
  iap_paused_until?: Maybe<Scalars['DateTime']>;
  iap_platform?: Maybe<Scalars['String']>;
  iap_product_id?: Maybe<Scalars['String']>;
  is_iap_pro?: Maybe<Scalars['Boolean']>;
  is_pro?: Maybe<Scalars['Boolean']>;
  pro_expires_at?: Maybe<Scalars['DateTime']>;
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
  iap_billing_issue_at?: Maybe<Scalars['DateTime']>;
  iap_cancellation_at?: Maybe<Scalars['DateTime']>;
  iap_latest_event_at?: Maybe<Scalars['DateTime']>;
  iap_paused_until?: Maybe<Scalars['DateTime']>;
  iap_platform?: Maybe<Scalars['String']>;
  iap_product_id?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  integrations?: Maybe<Array<Maybe<Integration>>>;
  is_premium?: Maybe<Scalars['Boolean']>;
  is_pro?: Maybe<Scalars['Boolean']>;
  join_country?: Maybe<Scalars['String']>;
  join_ip?: Maybe<Scalars['String']>;
  last_name?: Maybe<Scalars['String']>;
  last_seen_at?: Maybe<Scalars['DateTime']>;
  last_solve_at?: Maybe<Scalars['DateTime']>;
  mod?: Maybe<Scalars['Boolean']>;
  notification_preferences?: Maybe<NotificationPreference>;
  offline_hash?: Maybe<Scalars['String']>;
  pending_email?: Maybe<Scalars['String']>;
  premium_expires_at?: Maybe<Scalars['DateTime']>;
  pro_expires_at?: Maybe<Scalars['DateTime']>;
  profile?: Maybe<Profile>;
  pushTokens?: Maybe<Array<PushTokenInfo>>;
  reports_for?: Maybe<Array<Maybe<Report>>>;
  revenuecat_user_id?: Maybe<Scalars['String']>;
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

export type InboxSummary = {
  __typename?: 'InboxSummary';
  request_count?: Maybe<Scalars['Int']>;
  unread_total?: Maybe<Scalars['Int']>;
};

export type Integration = {
  __typename?: 'Integration';
  auth_expires_at?: Maybe<Scalars['BigInt']>;
  created_at?: Maybe<Scalars['DateTime']>;
  id?: Maybe<Scalars['String']>;
  last_synced_at?: Maybe<Scalars['DateTime']>;
  revoked_at?: Maybe<Scalars['DateTime']>;
  service_name?: Maybe<IntegrationType>;
  user?: Maybe<PublicUserAccount>;
  user_id?: Maybe<Scalars['String']>;
  wca_avatar_url?: Maybe<Scalars['String']>;
  wca_competition_count?: Maybe<Scalars['Float']>;
  wca_country_iso2?: Maybe<Scalars['String']>;
  wca_id?: Maybe<Scalars['String']>;
  wca_medal_bronze?: Maybe<Scalars['Float']>;
  wca_medal_gold?: Maybe<Scalars['Float']>;
  wca_medal_silver?: Maybe<Scalars['Float']>;
  wca_name?: Maybe<Scalars['String']>;
  wca_record_cr?: Maybe<Scalars['Float']>;
  wca_record_nr?: Maybe<Scalars['Float']>;
  wca_record_wr?: Maybe<Scalars['Float']>;
  wca_show_competitions?: Maybe<Scalars['Boolean']>;
  wca_show_medals?: Maybe<Scalars['Boolean']>;
  wca_show_rank?: Maybe<Scalars['Boolean']>;
  wca_show_records?: Maybe<Scalars['Boolean']>;
  wca_show_results?: Maybe<Scalars['Boolean']>;
  wca_user_id?: Maybe<Scalars['String']>;
  zkt_avatar_url?: Maybe<Scalars['String']>;
  zkt_country_iso2?: Maybe<Scalars['String']>;
  zkt_id?: Maybe<Scalars['String']>;
  zkt_member_no?: Maybe<Scalars['Float']>;
  zkt_name?: Maybe<Scalars['String']>;
  zkt_show_competitions?: Maybe<Scalars['Boolean']>;
  zkt_show_medals?: Maybe<Scalars['Boolean']>;
  zkt_show_pbs?: Maybe<Scalars['Boolean']>;
  zkt_show_records?: Maybe<Scalars['Boolean']>;
  zkt_user_id?: Maybe<Scalars['String']>;
};

export enum IntegrationType {
  Wca = 'wca',
  Zkt = 'zkt'
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
  iap_billing_issue_at?: Maybe<Scalars['DateTime']>;
  iap_cancellation_at?: Maybe<Scalars['DateTime']>;
  iap_latest_event_at?: Maybe<Scalars['DateTime']>;
  iap_paused_until?: Maybe<Scalars['DateTime']>;
  iap_platform?: Maybe<Scalars['String']>;
  iap_product_id?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  integrations?: Maybe<Array<Maybe<Integration>>>;
  is_premium?: Maybe<Scalars['Boolean']>;
  is_pro?: Maybe<Scalars['Boolean']>;
  join_country?: Maybe<Scalars['String']>;
  join_ip?: Maybe<Scalars['String']>;
  last_name?: Maybe<Scalars['String']>;
  last_seen_at?: Maybe<Scalars['DateTime']>;
  last_solve_at?: Maybe<Scalars['DateTime']>;
  mod?: Maybe<Scalars['Boolean']>;
  notification_preferences?: Maybe<NotificationPreference>;
  offline_hash?: Maybe<Scalars['String']>;
  pending_email?: Maybe<Scalars['String']>;
  premium_expires_at?: Maybe<Scalars['DateTime']>;
  pro_expires_at?: Maybe<Scalars['DateTime']>;
  profile?: Maybe<Profile>;
  pushTokens?: Maybe<Array<PushTokenInfo>>;
  reports_for?: Maybe<Array<Maybe<Report>>>;
  revenuecat_user_id?: Maybe<Scalars['String']>;
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
  last_seen_at?: Maybe<Scalars['DateTime']>;
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
  email_verified?: Maybe<Scalars['Boolean']>;
  first_name?: Maybe<Scalars['String']>;
  has_password?: Maybe<Scalars['Boolean']>;
  id?: Maybe<Scalars['String']>;
  integrations?: Maybe<Array<Maybe<Integration>>>;
  is_premium?: Maybe<Scalars['Boolean']>;
  is_pro?: Maybe<Scalars['Boolean']>;
  join_country?: Maybe<Scalars['String']>;
  last_name?: Maybe<Scalars['String']>;
  last_seen_at?: Maybe<Scalars['DateTime']>;
  last_solve_at?: Maybe<Scalars['DateTime']>;
  mod?: Maybe<Scalars['Boolean']>;
  offline_hash?: Maybe<Scalars['String']>;
  pending_email?: Maybe<Scalars['String']>;
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
  iap_billing_issue_at?: Maybe<Scalars['DateTime']>;
  iap_cancellation_at?: Maybe<Scalars['DateTime']>;
  iap_latest_event_at?: Maybe<Scalars['DateTime']>;
  iap_paused_until?: Maybe<Scalars['DateTime']>;
  iap_platform?: Maybe<Scalars['String']>;
  iap_product_id?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  integrations?: Maybe<Array<Maybe<Integration>>>;
  is_premium?: Maybe<Scalars['Boolean']>;
  is_pro?: Maybe<Scalars['Boolean']>;
  join_country?: Maybe<Scalars['String']>;
  join_ip?: Maybe<Scalars['String']>;
  last_name?: Maybe<Scalars['String']>;
  last_seen_at?: Maybe<Scalars['DateTime']>;
  last_solve_at?: Maybe<Scalars['DateTime']>;
  mod?: Maybe<Scalars['Boolean']>;
  notification_preferences?: Maybe<NotificationPreference>;
  offline_hash?: Maybe<Scalars['String']>;
  pending_email?: Maybe<Scalars['String']>;
  premium_expires_at?: Maybe<Scalars['DateTime']>;
  pro_expires_at?: Maybe<Scalars['DateTime']>;
  profile?: Maybe<Profile>;
  pushTokens?: Maybe<Array<PushTokenInfo>>;
  reports_for?: Maybe<Array<Maybe<Report>>>;
  revenuecat_user_id?: Maybe<Scalars['String']>;
  settings?: Maybe<Setting>;
  summary?: Maybe<UserAccountSummary>;
  timer_background?: Maybe<TimerBackground>;
  top_averages?: Maybe<Array<Maybe<TopAverage>>>;
  top_solves?: Maybe<Array<Maybe<TopSolve>>>;
  username?: Maybe<Scalars['String']>;
  verified?: Maybe<Scalars['Boolean']>;
};

export type LandingStats = {
  __typename?: 'LandingStats';
  cuber_count?: Maybe<Scalars['Int']>;
  solve_count?: Maybe<Scalars['Int']>;
  supported_event_count?: Maybe<Scalars['Int']>;
  supported_language_count?: Maybe<Scalars['Int']>;
  total_competitor_capacity?: Maybe<Scalars['Int']>;
  upcoming_wca_competition_count?: Maybe<Scalars['Int']>;
};

export type MagnetTelemetryInput = {
  app_version?: InputMaybe<Scalars['String']>;
  approach_ms?: InputMaybe<Scalars['Int']>;
  cube_puzzle?: InputMaybe<Scalars['String']>;
  delta_ut?: InputMaybe<Scalars['Float']>;
  detail?: InputMaybe<Scalars['String']>;
  device_model?: InputMaybe<Scalars['String']>;
  event_type?: InputMaybe<Scalars['String']>;
  latency_ms?: InputMaybe<Scalars['Int']>;
  near_min_ut?: InputMaybe<Scalars['Float']>;
  os_version?: InputMaybe<Scalars['String']>;
  platform?: InputMaybe<Scalars['String']>;
  rate_hz?: InputMaybe<Scalars['Float']>;
  rest_ms?: InputMaybe<Scalars['Int']>;
  reversed?: InputMaybe<Scalars['Boolean']>;
  samples?: InputMaybe<Scalars['String']>;
  sensor_name?: InputMaybe<Scalars['String']>;
  sigma?: InputMaybe<Scalars['Float']>;
};

export type MagnetTelemetryResult = {
  __typename?: 'MagnetTelemetryResult';
  accepted?: Maybe<Scalars['Int']>;
  enabled?: Maybe<Scalars['Boolean']>;
};

export type MagnetTelemetryRow = {
  __typename?: 'MagnetTelemetryRow';
  app_version?: Maybe<Scalars['String']>;
  approach_ms?: Maybe<Scalars['Int']>;
  created_at?: Maybe<Scalars['DateTime']>;
  cube_puzzle?: Maybe<Scalars['String']>;
  delta_ut?: Maybe<Scalars['Float']>;
  detail?: Maybe<Scalars['String']>;
  device_model?: Maybe<Scalars['String']>;
  event_type?: Maybe<Scalars['String']>;
  has_samples?: Maybe<Scalars['Boolean']>;
  id?: Maybe<Scalars['String']>;
  latency_ms?: Maybe<Scalars['Int']>;
  near_min_ut?: Maybe<Scalars['Float']>;
  os_version?: Maybe<Scalars['String']>;
  platform?: Maybe<Scalars['String']>;
  rate_hz?: Maybe<Scalars['Float']>;
  rest_ms?: Maybe<Scalars['Int']>;
  reversed?: Maybe<Scalars['Boolean']>;
  sensor_name?: Maybe<Scalars['String']>;
  sigma?: Maybe<Scalars['Float']>;
  username?: Maybe<Scalars['String']>;
};

export type MagnetTelemetrySummary = {
  __typename?: 'MagnetTelemetrySummary';
  cube_puzzle?: Maybe<Scalars['String']>;
  device_model?: Maybe<Scalars['String']>;
  distinct_users?: Maybe<Scalars['Int']>;
  lifts?: Maybe<Scalars['Int']>;
  median_approach_ms?: Maybe<Scalars['Int']>;
  median_latency_ms?: Maybe<Scalars['Int']>;
  median_near_min_ut?: Maybe<Scalars['Float']>;
  median_near_ut?: Maybe<Scalars['Float']>;
  median_sigma?: Maybe<Scalars['Float']>;
  min_near_ut?: Maybe<Scalars['Float']>;
  p95_latency_ms?: Maybe<Scalars['Int']>;
  placements?: Maybe<Scalars['Int']>;
  platform?: Maybe<Scalars['String']>;
  rate_hz?: Maybe<Scalars['Float']>;
  refused?: Maybe<Scalars['Int']>;
  rejects?: Maybe<Scalars['Int']>;
  sensor_name?: Maybe<Scalars['String']>;
  started?: Maybe<Scalars['Int']>;
  unknown_hints?: Maybe<Scalars['Int']>;
  unsupported?: Maybe<Scalars['Int']>;
};

export type MediaAsset = {
  __typename?: 'MediaAsset';
  background_target?: Maybe<Scalars['String']>;
  created_at?: Maybe<Scalars['DateTime']>;
  id?: Maybe<Scalars['String']>;
  is_video?: Maybe<Scalars['Boolean']>;
  kind?: Maybe<MediaAssetKind>;
  size_bytes?: Maybe<Scalars['Int']>;
  storage_path?: Maybe<Scalars['String']>;
  user?: Maybe<PublicUserAccount>;
};

export enum MediaAssetKind {
  ProfileHeader = 'PROFILE_HEADER',
  ProfilePicture = 'PROFILE_PICTURE',
  TimerBackground = 'TIMER_BACKGROUND'
}

export type MediaAssetPage = {
  __typename?: 'MediaAssetPage';
  items?: Maybe<Array<Maybe<MediaAsset>>>;
  total?: Maybe<Scalars['Int']>;
};

export type Message = {
  __typename?: 'Message';
  body?: Maybe<Scalars['String']>;
  conversation_id?: Maybe<Scalars['String']>;
  created_at?: Maybe<Scalars['DateTime']>;
  edited_at?: Maybe<Scalars['DateTime']>;
  id?: Maybe<Scalars['String']>;
  reactions?: Maybe<Array<MessageReaction>>;
  reply_to?: Maybe<ReplyPreview>;
  sender?: Maybe<PublicUserAccount>;
  sender_id?: Maybe<Scalars['String']>;
  solve?: Maybe<Solve>;
};

export type MessageList = {
  __typename?: 'MessageList';
  accepted?: Maybe<Scalars['Boolean']>;
  awaiting_accept?: Maybe<Scalars['Boolean']>;
  messages?: Maybe<Array<Maybe<Message>>>;
  more_results?: Maybe<Scalars['Boolean']>;
  muted?: Maybe<Scalars['Boolean']>;
};

export type MessageReaction = {
  __typename?: 'MessageReaction';
  emoji?: Maybe<Scalars['String']>;
  user_id?: Maybe<Scalars['String']>;
};

export type MessageReportList = {
  __typename?: 'MessageReportList';
  more_results?: Maybe<Scalars['Boolean']>;
  open_count?: Maybe<Scalars['Int']>;
  reports?: Maybe<Array<Maybe<MessageReportView>>>;
};

export type MessageReportView = {
  __typename?: 'MessageReportView';
  created_at?: Maybe<Scalars['DateTime']>;
  id?: Maybe<Scalars['String']>;
  moderator_note?: Maybe<Scalars['String']>;
  reason?: Maybe<Scalars['String']>;
  reported?: Maybe<PublicUserAccount>;
  reporter?: Maybe<PublicUserAccount>;
  reviewed_at?: Maybe<Scalars['DateTime']>;
  reviewed_by?: Maybe<PublicUserAccount>;
  snapshot?: Maybe<Array<Maybe<ReportSnapshotMessage>>>;
  status?: Maybe<ReportStatus>;
};

export type MethodStepsBackfillResult = {
  __typename?: 'MethodStepsBackfillResult';
  downgraded?: Maybe<Scalars['Int']>;
  error?: Maybe<Scalars['Int']>;
  filled?: Maybe<Scalars['Int']>;
  finishedAt?: Maybe<Scalars['String']>;
  methodChanged?: Maybe<Scalars['Int']>;
  processed?: Maybe<Scalars['Int']>;
  running?: Maybe<Scalars['Boolean']>;
  skippedAlreadyHasSteps?: Maybe<Scalars['Int']>;
  skippedNoTurns?: Maybe<Scalars['Int']>;
  startedAt?: Maybe<Scalars['String']>;
  totalCandidates?: Maybe<Scalars['Int']>;
};

export type Mutation = {
  __typename?: 'Mutation';
  acceptConversationRequest?: Maybe<Scalars['Boolean']>;
  addAlgSetItems?: Maybe<AlgSet>;
  addBadgeToUser?: Maybe<Badge>;
  addNewSmartDevice?: Maybe<SmartDevice>;
  addSupportTicketMessage?: Maybe<SupportTicketMessage>;
  adminDeleteTrainerAlternative?: Maybe<TrainerAlternative>;
  adminDeleteUserAccount?: Maybe<UserAccount>;
  adminSendPushToUser?: Maybe<AdminSendPushResult>;
  adminSetAlgSetHidden?: Maybe<AlgSet>;
  adminVoidBattleMatch?: Maybe<VoidBattleMatchResult>;
  archiveConversation?: Maybe<Scalars['Boolean']>;
  authenticateUser: PublicUserAccount;
  authenticateWithWca?: Maybe<WcaOAuthResult>;
  authenticateWithZkt?: Maybe<ZktOAuthResult>;
  backfillWcaIds?: Maybe<BackfillResult>;
  backfillZktIds?: Maybe<ZktBackfillResult>;
  banUserAccount?: Maybe<BanLog>;
  blockUser?: Maybe<Scalars['Boolean']>;
  bulkArchiveWcaCompetitions?: Maybe<BulkArchiveResult>;
  bulkCreateSessions?: Maybe<Scalars['Void']>;
  bulkCreateSolves?: Maybe<Scalars['Void']>;
  bulkDeleteSessions?: Maybe<Scalars['Void']>;
  changeSmartDeviceName?: Maybe<SmartDevice>;
  checkForgotPasswordCode?: Maybe<Scalars['Boolean']>;
  clearConversation?: Maybe<Scalars['Boolean']>;
  completeWcaSignup?: Maybe<PublicUserAccount>;
  completeZktSignup?: Maybe<PublicUserAccount>;
  confirmEmailChange?: Maybe<PublicUserAccount>;
  createAlgSet?: Maybe<AlgSet>;
  createAnnouncement?: Maybe<Announcement>;
  createBadgeType?: Maybe<BadgeType>;
  createCube?: Maybe<Cube>;
  createCustomCubeType?: Maybe<CustomCubeType>;
  createCustomTrainer?: Maybe<CustomTrainer>;
  createIntegration?: Maybe<Integration>;
  createPromoCode?: Maybe<PromoCode>;
  createSession?: Maybe<Session>;
  createSolve?: Maybe<Solve>;
  createSupportTicket?: Maybe<SupportTicket>;
  createUserAccount?: Maybe<PublicUserAccount>;
  deleteAlgorithmOverride?: Maybe<AlgorithmOverride>;
  deleteAlgSet?: Maybe<Scalars['Boolean']>;
  deleteAllNotifications?: Maybe<Scalars['Int']>;
  deleteAllSolves?: Maybe<Scalars['Void']>;
  deleteAllSolvesInSession?: Maybe<Scalars['Void']>;
  deleteAllTrainingSolves?: Maybe<Scalars['Void']>;
  deleteAnnouncement?: Maybe<Scalars['Boolean']>;
  deleteBadgeType?: Maybe<BadgeType>;
  deleteCube?: Maybe<Scalars['Boolean']>;
  deleteCubeCalibration?: Maybe<Scalars['Boolean']>;
  deleteCustomCubeType?: Maybe<CustomCubeType>;
  deleteCustomTrainer?: Maybe<CustomTrainer>;
  deleteIntegration?: Maybe<Integration>;
  deleteMediaAsset?: Maybe<Scalars['Boolean']>;
  deleteNotification?: Maybe<Notification>;
  deletePromoCode?: Maybe<Scalars['Boolean']>;
  deleteRecordWatch?: Maybe<Scalars['Boolean']>;
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
  editMessage?: Maybe<Message>;
  ensureSmartCube?: Maybe<Cube>;
  fetchWcaRecords?: Maybe<Array<Maybe<WcaRecord>>>;
  followCompetitor?: Maybe<CompetitionFollow>;
  linkRevenueCatUser?: Maybe<Scalars['Boolean']>;
  logOut: PublicUserAccount;
  markAnnouncementAsViewed?: Maybe<Scalars['Boolean']>;
  markConversationRead?: Maybe<Scalars['Boolean']>;
  markNotificationAsRead?: Maybe<Notification>;
  markSupportTicketRead?: Maybe<SupportTicket>;
  mergeOllcpStats?: Maybe<Scalars['Boolean']>;
  mergeSessions?: Maybe<Session>;
  publishTopAverages?: Maybe<TopAverage>;
  publishTopSolve?: Maybe<TopSolve>;
  publishWcaRecord?: Maybe<WcaRecord>;
  recordActivityHeartbeat?: Maybe<ActivityHeartbeatResult>;
  recordMagnetTelemetry?: Maybe<MagnetTelemetryResult>;
  recordOllcpAttempt?: Maybe<OllcpStatType>;
  recordProfileView: Scalars['Boolean'];
  recordSmartCubeTelemetry?: Maybe<SmartCubeTelemetryResult>;
  recordSolveView: Scalars['Boolean'];
  redeemPromoCode?: Maybe<RedeemPromoCodeResult>;
  registerPushToken?: Maybe<PushTokenResult>;
  reindexArchivedCompsToES?: Maybe<ReindexEsResult>;
  reindexLLCaseKeys?: Maybe<ReindexLlResult>;
  reindexSmartCubeMethodSteps?: Maybe<MethodStepsBackfillResult>;
  removeAlgSetItems?: Maybe<AlgSet>;
  removeBadgeFromUser?: Maybe<Badge>;
  removeDailyGoal?: Maybe<Scalars['Boolean']>;
  reopenSupportTicket?: Maybe<SupportTicket>;
  reorderAlgSetItems?: Maybe<AlgSet>;
  reorderSessions?: Maybe<Scalars['Void']>;
  reportAlgSet?: Maybe<Scalars['Boolean']>;
  reportConversation?: Maybe<Scalars['Boolean']>;
  reportProfile?: Maybe<Report>;
  resendEmailVerificationCode?: Maybe<Scalars['Void']>;
  resetAlgSetCode?: Maybe<AlgSet>;
  resetSettings?: Maybe<Setting>;
  resolveMessageReport?: Maybe<Scalars['Boolean']>;
  resolveReports?: Maybe<Scalars['Float']>;
  resolveSupportTicket?: Maybe<SupportTicket>;
  saveAlgSet?: Maybe<Scalars['Boolean']>;
  saveCubeCalibration?: Maybe<CubeCalibration>;
  saveRecordWatch?: Maybe<RecordWatch>;
  sendBulkEmail?: Maybe<BulkEmailResult>;
  sendForgotPasswordCode?: Maybe<Scalars['Void']>;
  sendMessage?: Maybe<Message>;
  sendTestRecordNotification?: Maybe<Scalars['Boolean']>;
  setConversationMuted?: Maybe<Scalars['Boolean']>;
  setCubeArchived?: Maybe<Cube>;
  setDailyGoal?: Maybe<DailyGoalType>;
  setDailyGoalCountRoomSolves?: Maybe<DailyGoalReminderResult>;
  setDailyGoalReminder?: Maybe<DailyGoalReminderResult>;
  setMainCube?: Maybe<CubeMain>;
  setMessageReaction?: Maybe<Scalars['Boolean']>;
  setModStatus?: Maybe<UserAccount>;
  setPremiumStatus?: Maybe<UserAccount>;
  setProStatus?: Maybe<UserAccount>;
  setRecordWatchEnabled?: Maybe<RecordWatch>;
  setSetting?: Maybe<Setting>;
  setTimerBackgroundMobileSame: TimerBackground;
  setTyping?: Maybe<Scalars['Boolean']>;
  setUserPassword?: Maybe<PublicUserAccount>;
  setVerifiedStatus?: Maybe<UserAccount>;
  splitSession?: Maybe<Session>;
  testWcaNotification?: Maybe<Scalars['Boolean']>;
  togglePromoCodeActive?: Maybe<PromoCode>;
  translateAnnouncementContent?: Maybe<TranslateAnnouncementResult>;
  unbanUserAccount?: Maybe<UserAccount>;
  unblockUser?: Maybe<Scalars['Boolean']>;
  unfollowCompetitor?: Maybe<Scalars['Boolean']>;
  unpublishWcaRecord?: Maybe<WcaRecord>;
  unregisterPushToken?: Maybe<PushTokenResult>;
  unsaveAlgSet?: Maybe<Scalars['Boolean']>;
  unsendMessage?: Maybe<Scalars['Boolean']>;
  unsubEmails?: Maybe<Scalars['Boolean']>;
  updateAlgorithmOverride?: Maybe<AlgorithmOverride>;
  updateAlgSet?: Maybe<AlgSet>;
  updateAlgSetItem?: Maybe<AlgSetItem>;
  updateAnnouncement?: Maybe<Announcement>;
  updateCube?: Maybe<Cube>;
  updateCustomTrainer?: Maybe<CustomTrainer>;
  updateForgotPassword?: Maybe<PublicUserAccount>;
  updateNotificationPreferences?: Maybe<NotificationPreference>;
  updateOfflineHash?: Maybe<Scalars['String']>;
  updateProfile: Profile;
  updateSession?: Maybe<Session>;
  updateSiteConfig?: Maybe<SiteConfig>;
  updateSocialPreference?: Maybe<SocialPreference>;
  updateSolve: Solve;
  updateStatsModuleBlocks?: Maybe<StatsModule>;
  updateUserAccount?: Maybe<PublicUserAccount>;
  updateUserPassword?: Maybe<PublicUserAccount>;
  updateWcaVisibility?: Maybe<Integration>;
  updateZktVisibility?: Maybe<Integration>;
  uploadProfileHeader: Image;
  uploadProfilePicture: Image;
  uploadTimerBackground: TimerBackground;
  verifyEmailCode?: Maybe<PublicUserAccount>;
  voteReconstruction?: Maybe<Scalars['Boolean']>;
};


export type MutationAcceptConversationRequestArgs = {
  conversationId?: InputMaybe<Scalars['String']>;
};


export type MutationAddAlgSetItemsArgs = {
  items?: InputMaybe<Array<InputMaybe<AlgSetItemInput>>>;
  set_id?: InputMaybe<Scalars['String']>;
};


export type MutationAddBadgeToUserArgs = {
  badgeTypeId?: InputMaybe<Scalars['String']>;
  userId?: InputMaybe<Scalars['String']>;
};


export type MutationAddNewSmartDeviceArgs = {
  deviceId?: InputMaybe<Scalars['String']>;
  originalName?: InputMaybe<Scalars['String']>;
};


export type MutationAddSupportTicketMessageArgs = {
  attachments?: InputMaybe<Array<Scalars['Upload']>>;
  body?: InputMaybe<Scalars['String']>;
  ticketId?: InputMaybe<Scalars['String']>;
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


export type MutationAdminSetAlgSetHiddenArgs = {
  hidden?: InputMaybe<Scalars['Boolean']>;
  reason?: InputMaybe<Scalars['String']>;
  set_id?: InputMaybe<Scalars['String']>;
};


export type MutationAdminVoidBattleMatchArgs = {
  id?: InputMaybe<Scalars['String']>;
};


export type MutationArchiveConversationArgs = {
  conversationId?: InputMaybe<Scalars['String']>;
};


export type MutationAuthenticateUserArgs = {
  email: Scalars['String'];
  password: Scalars['String'];
  remember?: InputMaybe<Scalars['Boolean']>;
};


export type MutationAuthenticateWithWcaArgs = {
  code?: InputMaybe<Scalars['String']>;
};


export type MutationAuthenticateWithZktArgs = {
  code?: InputMaybe<Scalars['String']>;
};


export type MutationBanUserAccountArgs = {
  input?: InputMaybe<BanUserInput>;
};


export type MutationBlockUserArgs = {
  userId?: InputMaybe<Scalars['String']>;
};


export type MutationBulkArchiveWcaCompetitionsArgs = {
  endDate?: InputMaybe<Scalars['String']>;
  rateLimitMs?: InputMaybe<Scalars['Int']>;
  skipExisting?: InputMaybe<Scalars['Boolean']>;
  startDate?: InputMaybe<Scalars['String']>;
};


export type MutationBulkCreateSessionsArgs = {
  sessions?: InputMaybe<Array<InputMaybe<SessionInput>>>;
};


export type MutationBulkCreateSolvesArgs = {
  solves?: InputMaybe<Array<InputMaybe<SolveInput>>>;
};


export type MutationBulkDeleteSessionsArgs = {
  ids?: InputMaybe<Array<InputMaybe<Scalars['String']>>>;
};


export type MutationChangeSmartDeviceNameArgs = {
  id?: InputMaybe<Scalars['String']>;
  name?: InputMaybe<Scalars['String']>;
};


export type MutationCheckForgotPasswordCodeArgs = {
  code?: InputMaybe<Scalars['String']>;
  email?: InputMaybe<Scalars['String']>;
};


export type MutationClearConversationArgs = {
  conversationId?: InputMaybe<Scalars['String']>;
};


export type MutationCompleteWcaSignupArgs = {
  acceptedTerms: Scalars['Boolean'];
  pendingToken?: InputMaybe<Scalars['String']>;
  username?: InputMaybe<Scalars['String']>;
};


export type MutationCompleteZktSignupArgs = {
  acceptedTerms: Scalars['Boolean'];
  pendingToken?: InputMaybe<Scalars['String']>;
  username?: InputMaybe<Scalars['String']>;
};


export type MutationConfirmEmailChangeArgs = {
  code: Scalars['String'];
};


export type MutationCreateAlgSetArgs = {
  input?: InputMaybe<AlgSetCreateInput>;
};


export type MutationCreateAnnouncementArgs = {
  input?: InputMaybe<CreateAnnouncementInput>;
};


export type MutationCreateBadgeTypeArgs = {
  input?: InputMaybe<BadgeTypeInput>;
};


export type MutationCreateCubeArgs = {
  input?: InputMaybe<CubeInput>;
};


export type MutationCreateCustomCubeTypeArgs = {
  input?: InputMaybe<CustomCubeTypeInput>;
};


export type MutationCreateCustomTrainerArgs = {
  input?: InputMaybe<CustomTrainerCreateInput>;
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


export type MutationCreateSupportTicketArgs = {
  input?: InputMaybe<SupportTicketInput>;
};


export type MutationCreateUserAccountArgs = {
  email: Scalars['String'];
  first_name: Scalars['String'];
  language?: InputMaybe<Scalars['String']>;
  last_name: Scalars['String'];
  password: Scalars['String'];
  terms_agreed: Scalars['Boolean'];
  turnstile_token: Scalars['String'];
  username: Scalars['String'];
};


export type MutationDeleteAlgorithmOverrideArgs = {
  algoKey?: InputMaybe<Scalars['String']>;
};


export type MutationDeleteAlgSetArgs = {
  id?: InputMaybe<Scalars['String']>;
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


export type MutationDeleteCubeArgs = {
  id?: InputMaybe<Scalars['String']>;
};


export type MutationDeleteCubeCalibrationArgs = {
  id?: InputMaybe<Scalars['String']>;
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


export type MutationDeleteMediaAssetArgs = {
  id?: InputMaybe<Scalars['String']>;
  kind?: InputMaybe<MediaAssetKind>;
};


export type MutationDeleteNotificationArgs = {
  id?: InputMaybe<Scalars['String']>;
};


export type MutationDeletePromoCodeArgs = {
  id?: InputMaybe<Scalars['String']>;
};


export type MutationDeleteRecordWatchArgs = {
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


export type MutationDeleteTimerBackgroundArgs = {
  target?: InputMaybe<Scalars['String']>;
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


export type MutationEditMessageArgs = {
  body?: InputMaybe<Scalars['String']>;
  messageId?: InputMaybe<Scalars['String']>;
};


export type MutationEnsureSmartCubeArgs = {
  ble_device_id?: InputMaybe<Scalars['String']>;
  ble_name?: InputMaybe<Scalars['String']>;
};


export type MutationFollowCompetitorArgs = {
  input?: InputMaybe<FollowCompetitorInput>;
};


export type MutationMarkAnnouncementAsViewedArgs = {
  announcementId?: InputMaybe<Scalars['String']>;
};


export type MutationMarkConversationReadArgs = {
  conversationId?: InputMaybe<Scalars['String']>;
};


export type MutationMarkNotificationAsReadArgs = {
  id?: InputMaybe<Scalars['String']>;
};


export type MutationMarkSupportTicketReadArgs = {
  id?: InputMaybe<Scalars['String']>;
};


export type MutationMergeOllcpStatsArgs = {
  entries?: InputMaybe<Array<InputMaybe<OllcpStatInput>>>;
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


export type MutationRecordActivityHeartbeatArgs = {
  path?: InputMaybe<Scalars['String']>;
};


export type MutationRecordMagnetTelemetryArgs = {
  events?: InputMaybe<Array<InputMaybe<MagnetTelemetryInput>>>;
};


export type MutationRecordOllcpAttemptArgs = {
  algId?: InputMaybe<Scalars['String']>;
  correct?: InputMaybe<Scalars['Boolean']>;
};


export type MutationRecordProfileViewArgs = {
  username: Scalars['String'];
};


export type MutationRecordSmartCubeTelemetryArgs = {
  events?: InputMaybe<Array<InputMaybe<SmartCubeTelemetryInput>>>;
};


export type MutationRecordSolveViewArgs = {
  shareCode: Scalars['String'];
};


export type MutationRedeemPromoCodeArgs = {
  code?: InputMaybe<Scalars['String']>;
};


export type MutationRegisterPushTokenArgs = {
  input?: InputMaybe<RegisterPushTokenInput>;
};


export type MutationRemoveAlgSetItemsArgs = {
  item_ids?: InputMaybe<Array<InputMaybe<Scalars['String']>>>;
  set_id?: InputMaybe<Scalars['String']>;
};


export type MutationRemoveBadgeFromUserArgs = {
  badgeTypeId?: InputMaybe<Scalars['String']>;
  userId?: InputMaybe<Scalars['String']>;
};


export type MutationRemoveDailyGoalArgs = {
  cubeType?: InputMaybe<Scalars['String']>;
  scrambleSubset?: InputMaybe<Scalars['String']>;
};


export type MutationReopenSupportTicketArgs = {
  id?: InputMaybe<Scalars['String']>;
};


export type MutationReorderAlgSetItemsArgs = {
  item_ids?: InputMaybe<Array<InputMaybe<Scalars['String']>>>;
  set_id?: InputMaybe<Scalars['String']>;
};


export type MutationReorderSessionsArgs = {
  ids?: InputMaybe<Array<InputMaybe<Scalars['String']>>>;
};


export type MutationReportAlgSetArgs = {
  note?: InputMaybe<Scalars['String']>;
  reason?: InputMaybe<Scalars['String']>;
  set_id?: InputMaybe<Scalars['String']>;
};


export type MutationReportConversationArgs = {
  conversationId?: InputMaybe<Scalars['String']>;
  reason?: InputMaybe<Scalars['String']>;
};


export type MutationReportProfileArgs = {
  reason?: InputMaybe<Scalars['String']>;
  userId?: InputMaybe<Scalars['String']>;
};


export type MutationResendEmailVerificationCodeArgs = {
  email: Scalars['String'];
  language?: InputMaybe<Scalars['String']>;
};


export type MutationResetAlgSetCodeArgs = {
  id?: InputMaybe<Scalars['String']>;
};


export type MutationResolveMessageReportArgs = {
  action?: InputMaybe<ReportStatus>;
  note?: InputMaybe<Scalars['String']>;
  reportId?: InputMaybe<Scalars['String']>;
};


export type MutationResolveReportsArgs = {
  userId?: InputMaybe<Scalars['String']>;
};


export type MutationResolveSupportTicketArgs = {
  id?: InputMaybe<Scalars['String']>;
};


export type MutationSaveAlgSetArgs = {
  set_id?: InputMaybe<Scalars['String']>;
};


export type MutationSaveCubeCalibrationArgs = {
  input?: InputMaybe<CubeCalibrationInput>;
};


export type MutationSaveRecordWatchArgs = {
  input?: InputMaybe<SaveRecordWatchInput>;
};


export type MutationSendBulkEmailArgs = {
  input?: InputMaybe<SendBulkEmailInput>;
};


export type MutationSendForgotPasswordCodeArgs = {
  email?: InputMaybe<Scalars['String']>;
  language?: InputMaybe<Scalars['String']>;
};


export type MutationSendMessageArgs = {
  body?: InputMaybe<Scalars['String']>;
  conversationId?: InputMaybe<Scalars['String']>;
  recipientId?: InputMaybe<Scalars['String']>;
  replyToId?: InputMaybe<Scalars['String']>;
  solveId?: InputMaybe<Scalars['String']>;
};


export type MutationSendTestRecordNotificationArgs = {
  locale?: InputMaybe<Scalars['String']>;
  source?: InputMaybe<Scalars['String']>;
};


export type MutationSetConversationMutedArgs = {
  conversationId?: InputMaybe<Scalars['String']>;
  muted?: InputMaybe<Scalars['Boolean']>;
};


export type MutationSetCubeArchivedArgs = {
  archived?: InputMaybe<Scalars['Boolean']>;
  id?: InputMaybe<Scalars['String']>;
};


export type MutationSetDailyGoalArgs = {
  input?: InputMaybe<SetDailyGoalInput>;
};


export type MutationSetDailyGoalCountRoomSolvesArgs = {
  enabled?: InputMaybe<Scalars['Boolean']>;
};


export type MutationSetDailyGoalReminderArgs = {
  enabled?: InputMaybe<Scalars['Boolean']>;
};


export type MutationSetMainCubeArgs = {
  cube_id?: InputMaybe<Scalars['String']>;
  puzzle?: InputMaybe<Scalars['String']>;
  set_at?: InputMaybe<Scalars['DateTime']>;
};


export type MutationSetMessageReactionArgs = {
  emoji?: InputMaybe<Scalars['String']>;
  messageId?: InputMaybe<Scalars['String']>;
};


export type MutationSetModStatusArgs = {
  isMod?: InputMaybe<Scalars['Boolean']>;
  userId?: InputMaybe<Scalars['String']>;
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


export type MutationSetRecordWatchEnabledArgs = {
  enabled?: InputMaybe<Scalars['Boolean']>;
  id?: InputMaybe<Scalars['String']>;
};


export type MutationSetSettingArgs = {
  input?: InputMaybe<SettingInput>;
};


export type MutationSetTimerBackgroundMobileSameArgs = {
  same: Scalars['Boolean'];
};


export type MutationSetTypingArgs = {
  conversationId?: InputMaybe<Scalars['String']>;
  typing?: InputMaybe<Scalars['Boolean']>;
};


export type MutationSetUserPasswordArgs = {
  new_password: Scalars['String'];
};


export type MutationSetVerifiedStatusArgs = {
  userId?: InputMaybe<Scalars['String']>;
  verified?: InputMaybe<Scalars['Boolean']>;
};


export type MutationSplitSessionArgs = {
  buckets?: InputMaybe<Array<InputMaybe<SessionBucketInput>>>;
  name?: InputMaybe<Scalars['String']>;
  sessionId?: InputMaybe<Scalars['String']>;
};


export type MutationTestWcaNotificationArgs = {
  wcaId?: InputMaybe<Scalars['String']>;
};


export type MutationTogglePromoCodeActiveArgs = {
  id?: InputMaybe<Scalars['String']>;
  isActive?: InputMaybe<Scalars['Boolean']>;
};


export type MutationTranslateAnnouncementContentArgs = {
  content?: InputMaybe<Scalars['String']>;
  title?: InputMaybe<Scalars['String']>;
};


export type MutationUnbanUserAccountArgs = {
  userId?: InputMaybe<Scalars['String']>;
};


export type MutationUnblockUserArgs = {
  userId?: InputMaybe<Scalars['String']>;
};


export type MutationUnfollowCompetitorArgs = {
  id?: InputMaybe<Scalars['String']>;
};


export type MutationUnpublishWcaRecordArgs = {
  recordId?: InputMaybe<Scalars['String']>;
};


export type MutationUnregisterPushTokenArgs = {
  token?: InputMaybe<Scalars['String']>;
};


export type MutationUnsaveAlgSetArgs = {
  set_id?: InputMaybe<Scalars['String']>;
};


export type MutationUnsendMessageArgs = {
  messageId?: InputMaybe<Scalars['String']>;
};


export type MutationUnsubEmailsArgs = {
  unsubId?: InputMaybe<Scalars['String']>;
};


export type MutationUpdateAlgorithmOverrideArgs = {
  algoKey?: InputMaybe<Scalars['String']>;
  input?: InputMaybe<AlgorithmOverrideInput>;
};


export type MutationUpdateAlgSetArgs = {
  id?: InputMaybe<Scalars['String']>;
  input?: InputMaybe<AlgSetUpdateInput>;
};


export type MutationUpdateAlgSetItemArgs = {
  algorithm?: InputMaybe<Scalars['String']>;
  item_id?: InputMaybe<Scalars['String']>;
};


export type MutationUpdateAnnouncementArgs = {
  id?: InputMaybe<Scalars['String']>;
  input?: InputMaybe<UpdateAnnouncementInput>;
};


export type MutationUpdateCubeArgs = {
  id?: InputMaybe<Scalars['String']>;
  input?: InputMaybe<CubeUpdateInput>;
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


export type MutationUpdateSocialPreferenceArgs = {
  input?: InputMaybe<UpdateSocialPreferenceInput>;
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
  language?: InputMaybe<Scalars['String']>;
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


export type MutationUpdateZktVisibilityArgs = {
  showCompetitions?: InputMaybe<Scalars['Boolean']>;
  showMedals?: InputMaybe<Scalars['Boolean']>;
  showPbs?: InputMaybe<Scalars['Boolean']>;
  showRecords?: InputMaybe<Scalars['Boolean']>;
};


export type MutationUploadProfileHeaderArgs = {
  file?: InputMaybe<Scalars['Upload']>;
};


export type MutationUploadProfilePictureArgs = {
  file?: InputMaybe<Scalars['Upload']>;
};


export type MutationUploadTimerBackgroundArgs = {
  file?: InputMaybe<Scalars['Upload']>;
  target?: InputMaybe<Scalars['String']>;
};


export type MutationVerifyEmailCodeArgs = {
  code: Scalars['String'];
  email: Scalars['String'];
  language?: InputMaybe<Scalars['String']>;
};


export type MutationVoteReconstructionArgs = {
  id?: InputMaybe<Scalars['String']>;
  vote?: InputMaybe<Scalars['Int']>;
};

export type MyAlgSets = {
  __typename?: 'MyAlgSets';
  own?: Maybe<Array<Maybe<AlgSetSummary>>>;
  saved?: Maybe<Array<Maybe<SavedAlgSet>>>;
};

export type MyBattleRating = {
  __typename?: 'MyBattleRating';
  draws?: Maybe<Scalars['Int']>;
  games?: Maybe<Scalars['Int']>;
  losses?: Maybe<Scalars['Int']>;
  peak_rating?: Maybe<Scalars['Int']>;
  provisional?: Maybe<Scalars['Boolean']>;
  puzzle?: Maybe<Scalars['String']>;
  rank?: Maybe<Scalars['Int']>;
  rating?: Maybe<Scalars['Int']>;
  wins?: Maybe<Scalars['Int']>;
};

export type MyCubeState = {
  __typename?: 'MyCubeState';
  cubes?: Maybe<Array<Maybe<Cube>>>;
  mains?: Maybe<Array<Maybe<CubeMain>>>;
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
  battle_challenge?: Maybe<Scalars['Boolean']>;
  competition_groups_published?: Maybe<Scalars['Boolean']>;
  competition_results_official?: Maybe<Scalars['Boolean']>;
  competition_schedule_changed?: Maybe<Scalars['Boolean']>;
  created_at?: Maybe<Scalars['DateTime']>;
  id?: Maybe<Scalars['String']>;
  marketing_emails?: Maybe<Scalars['Boolean']>;
  support_ticket_reply?: Maybe<Scalars['Boolean']>;
  user_id?: Maybe<Scalars['String']>;
  zkt_competition_announced?: Maybe<Scalars['Boolean']>;
};

export type OllcpStatInput = {
  alg_id?: InputMaybe<Scalars['String']>;
  correct?: InputMaybe<Scalars['Int']>;
  total?: InputMaybe<Scalars['Int']>;
};

export type OllcpStatType = {
  __typename?: 'OllcpStatType';
  alg_id?: Maybe<Scalars['String']>;
  correct?: Maybe<Scalars['Int']>;
  total?: Maybe<Scalars['Int']>;
};

export type OnlineStats = {
  __typename?: 'OnlineStats';
  anonymous?: Maybe<Scalars['Int']>;
  totalSockets?: Maybe<Scalars['Int']>;
  uniqueUsers?: Maybe<Scalars['Int']>;
};

export type OnlineUser = {
  __typename?: 'OnlineUser';
  tabCount?: Maybe<Scalars['Int']>;
  user?: Maybe<PublicUserAccount>;
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
  last_seen_at?: Maybe<Scalars['DateTime']>;
  last_solve_at?: Maybe<Scalars['DateTime']>;
  mod?: Maybe<Scalars['Boolean']>;
  premium_expires_at?: Maybe<Scalars['DateTime']>;
  pro_expires_at?: Maybe<Scalars['DateTime']>;
  profile?: Maybe<Profile>;
  session_token?: Maybe<Scalars['String']>;
  top_averages?: Maybe<Array<Maybe<TopAverage>>>;
  top_solves?: Maybe<Array<Maybe<TopSolve>>>;
  username?: Maybe<Scalars['String']>;
  verified?: Maybe<Scalars['Boolean']>;
};

export type PublicWcaProfile = {
  __typename?: 'PublicWcaProfile';
  best_world_rank?: Maybe<Scalars['Float']>;
  best_world_rank_event?: Maybe<Scalars['String']>;
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

export type PublicZktProfile = {
  __typename?: 'PublicZktProfile';
  zkt_avatar_url?: Maybe<Scalars['String']>;
  zkt_competition_count?: Maybe<Scalars['Float']>;
  zkt_country_iso2?: Maybe<Scalars['String']>;
  zkt_id?: Maybe<Scalars['String']>;
  zkt_medal_bronze?: Maybe<Scalars['Float']>;
  zkt_medal_gold?: Maybe<Scalars['Float']>;
  zkt_medal_silver?: Maybe<Scalars['Float']>;
  zkt_member_no?: Maybe<Scalars['Float']>;
  zkt_name?: Maybe<Scalars['String']>;
  zkt_personal_bests?: Maybe<Array<ZktEventPb>>;
  zkt_record_count?: Maybe<Scalars['Float']>;
  zkt_show_competitions?: Maybe<Scalars['Boolean']>;
  zkt_show_medals?: Maybe<Scalars['Boolean']>;
  zkt_show_pbs?: Maybe<Scalars['Boolean']>;
  zkt_show_records?: Maybe<Scalars['Boolean']>;
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
  adminActiveUsers?: Maybe<AdminActiveUsersResult>;
  adminCubeCalibrations?: Maybe<Array<Maybe<AdminCubeCalibrationRow>>>;
  adminCubeCalibrationSummary?: Maybe<Array<Maybe<AdminCubeCalibrationSummary>>>;
  adminDashboardStats?: Maybe<AdminDashboardStats>;
  adminExportUserData?: Maybe<Scalars['String']>;
  adminFlaggedBattleMatches?: Maybe<AdminBattleMatchPage>;
  adminMyPushTokens?: Maybe<Array<Maybe<PushTokenInfo>>>;
  adminTrainerAlternatives?: Maybe<PaginatedTrainerAlternatives>;
  adminUserDailyActivity?: Maybe<UserDailyActivityResult>;
  adminUserSearch?: Maybe<PaginatedUserAccountsForAdmin>;
  algorithmOverrides?: Maybe<Array<Maybe<AlgorithmOverride>>>;
  algSet?: Maybe<AlgSet>;
  badgeTypes?: Maybe<Array<Maybe<BadgeType>>>;
  battleChallenge?: Maybe<BattleChallengeInfo>;
  battleHeadToHead?: Maybe<BattleHeadToHead>;
  battleLeaderboard?: Maybe<BattleLeaderboardPage>;
  battleMatch?: Maybe<BattleMatchDetail>;
  battleMatchHistory?: Maybe<BattleMatchHistoryPage>;
  blockedUsers?: Maybe<Array<Maybe<BlockedUser>>>;
  caseStats?: Maybe<Array<Maybe<CaseStat>>>;
  communityAlgSets?: Maybe<CommunityAlgSetPage>;
  conversations?: Maybe<ConversationList>;
  customCubeTypes?: Maybe<Array<Maybe<CustomCubeType>>>;
  customTrainer?: Maybe<CustomTrainer>;
  customTrainers?: Maybe<Array<Maybe<CustomTrainer>>>;
  dailyGoalReminderStatus?: Maybe<DailyGoalReminderResult>;
  dailyGoals?: Maybe<Array<Maybe<DailyGoalType>>>;
  dmPresence?: Maybe<Array<Maybe<Scalars['String']>>>;
  getActiveAnnouncements?: Maybe<Array<Maybe<Announcement>>>;
  getAllAnnouncements?: Maybe<Array<Maybe<Announcement>>>;
  getIapStatus?: Maybe<IapStatus>;
  getMyAnnouncementHistory?: Maybe<Array<Maybe<Announcement>>>;
  getPromoCodeRedemptions?: Maybe<Array<Maybe<PromoCodeRedemptionInfo>>>;
  getPromoCodes?: Maybe<Array<Maybe<PromoCode>>>;
  getUnreadAnnouncementCount?: Maybe<UnreadAnnouncementCount>;
  getUserAccountForAdmin?: Maybe<UserAccountForAdmin>;
  inboxSummary?: Maybe<InboxSummary>;
  integration?: Maybe<Integration>;
  integrations?: Maybe<Array<Maybe<Integration>>>;
  landingStats?: Maybe<LandingStats>;
  magnetTelemetryRows?: Maybe<Array<Maybe<MagnetTelemetryRow>>>;
  magnetTelemetrySamples?: Maybe<Scalars['String']>;
  magnetTelemetrySummary?: Maybe<Array<Maybe<MagnetTelemetrySummary>>>;
  me: UserAccount;
  mediaAssets?: Maybe<MediaAssetPage>;
  messageRecipientSearch?: Maybe<Array<Maybe<PublicUserAccount>>>;
  messageReports?: Maybe<MessageReportList>;
  messages?: Maybe<MessageList>;
  methodStepsReindexStatus?: Maybe<MethodStepsBackfillResult>;
  myAlgSets?: Maybe<MyAlgSets>;
  myBattleRating?: Maybe<MyBattleRating>;
  myCompetitionFollows?: Maybe<Array<Maybe<CompetitionFollow>>>;
  myCubeState?: Maybe<MyCubeState>;
  myOllcpStats?: Maybe<Array<Maybe<OllcpStatType>>>;
  myRecordWatches?: Maybe<Array<Maybe<RecordWatch>>>;
  myRoomSolveEntries?: Maybe<Array<Maybe<RoomSolveEntry>>>;
  mySessionIds?: Maybe<Array<Maybe<Scalars['String']>>>;
  mySolveFingerprints?: Maybe<Array<Maybe<Scalars['String']>>>;
  mySolveIds?: Maybe<Array<Maybe<Scalars['String']>>>;
  mySupportTickets?: Maybe<Array<Maybe<SupportTicket>>>;
  myWcaCompetitions?: Maybe<Array<Maybe<WcaCompetition>>>;
  myWcaRecords?: Maybe<Array<Maybe<WcaRecord>>>;
  myZktProfile?: Maybe<PublicZktProfile>;
  notificationPreferences?: Maybe<NotificationPreference>;
  notifications?: Maybe<Array<Maybe<Notification>>>;
  onlineStats?: Maybe<OnlineStats>;
  onlineUsers?: Maybe<Array<Maybe<OnlineUser>>>;
  profile: Profile;
  publicWcaProfile?: Maybe<PublicWcaProfile>;
  publicZktProfile?: Maybe<PublicZktProfile>;
  recoverMySolves?: Maybe<Array<Maybe<Solve>>>;
  registrationWatchAccess?: Maybe<Scalars['Boolean']>;
  registrationWatchCompetition?: Maybe<RegistrationWatchDetail>;
  registrationWatchCompetitions?: Maybe<Array<Maybe<RegistrationWatchCompetitionRow>>>;
  reports?: Maybe<Array<Maybe<ReportSummary>>>;
  sessions?: Maybe<Array<Maybe<Session>>>;
  settings?: Maybe<Setting>;
  siteConfig?: Maybe<SiteConfig>;
  smartCubeTelemetryRows?: Maybe<Array<Maybe<SmartCubeTelemetryRow>>>;
  smartCubeTelemetrySummary?: Maybe<Array<Maybe<SmartCubeTelemetrySummary>>>;
  smartDevices?: Maybe<Array<Maybe<SmartDevice>>>;
  socialPreference?: Maybe<SocialPreference>;
  solve?: Maybe<Solve>;
  solveByShareCode?: Maybe<Solve>;
  solveList?: Maybe<SolveList>;
  solveReplayData?: Maybe<SolveReplayData>;
  solves?: Maybe<Array<Maybe<Solve>>>;
  solvesByIds?: Maybe<Array<Maybe<Solve>>>;
  stats?: Maybe<Stats>;
  statsModule?: Maybe<StatsModule>;
  supportTicket?: Maybe<SupportTicket>;
  supportTickets?: Maybe<Array<Maybe<SupportTicket>>>;
  topAverages?: Maybe<Array<Maybe<TopAverage>>>;
  topSolves?: Maybe<Array<Maybe<TopSolve>>>;
  trainerAlternatives?: Maybe<Array<Maybe<TrainerAlternative>>>;
  trainerLibrary?: Maybe<TrainerLibrary>;
  trainerLibraryAlternatives?: Maybe<TrainerLibraryAlternatives>;
  unreadNotificationCount?: Maybe<Scalars['Int']>;
  userBattleRating?: Maybe<MyBattleRating>;
  userSearch?: Maybe<PaginatedUserAccounts>;
  wcaCompetitionDetail?: Maybe<WcaCompetitionDetail>;
  wcaCompetitions?: Maybe<Array<Maybe<WcaCompetition>>>;
  wcaLiveCompetitionOverview?: Maybe<WcaLiveCompetitionOverview>;
  wcaLiveCompetitorResults?: Maybe<WcaLiveCompetitorResults>;
  wcaLiveRoundResults?: Maybe<WcaLiveRoundResults>;
  wcaMe?: Maybe<WcaAccount>;
  wcaRecentRecords?: Maybe<Array<Maybe<WcaRecentRecord>>>;
  wcaRecords?: Maybe<Array<Maybe<WcaRecord>>>;
  wcaResults?: Maybe<Array<Maybe<WcaResult>>>;
  wcaSearchCompetitions?: Maybe<Array<Maybe<WcaCompetition>>>;
  wcaStats?: Maybe<WcaStats>;
  youtubeSearch?: Maybe<Array<Maybe<YouTubeVideoResult>>>;
  zktPersonBests?: Maybe<Array<ZktEventPb>>;
  zktPublicCompetition?: Maybe<ZktPublicCompetitionDetail>;
  zktPublicCompetitions?: Maybe<ZktPublicCompetitionList>;
  zktPublicCompetitor?: Maybe<ZktPublicCompetitorDetail>;
  zktPublicGroupAssignments?: Maybe<ZktPublicGroupAssignments>;
  zktPublicMyCompetitions?: Maybe<Array<Maybe<ZktPublicMyListItem>>>;
  zktPublicRoundResults?: Maybe<ZktPublicRoundResults>;
};


export type QueryAdminActiveUsersArgs = {
  monthYear?: InputMaybe<Scalars['String']>;
  period?: InputMaybe<Scalars['String']>;
};


export type QueryAdminCubeCalibrationsArgs = {
  deviceModel?: InputMaybe<Scalars['String']>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  platform?: InputMaybe<Scalars['String']>;
  puzzle?: InputMaybe<Scalars['String']>;
  username?: InputMaybe<Scalars['String']>;
};


export type QueryAdminCubeCalibrationSummaryArgs = {
  days?: InputMaybe<Scalars['Int']>;
};


export type QueryAdminExportUserDataArgs = {
  userId?: InputMaybe<Scalars['String']>;
};


export type QueryAdminFlaggedBattleMatchesArgs = {
  page?: InputMaybe<Scalars['Int']>;
};


export type QueryAdminTrainerAlternativesArgs = {
  category?: InputMaybe<Scalars['String']>;
  page?: InputMaybe<Scalars['Int']>;
  pageSize?: InputMaybe<Scalars['Int']>;
};


export type QueryAdminUserDailyActivityArgs = {
  userId?: InputMaybe<Scalars['String']>;
};


export type QueryAdminUserSearchArgs = {
  filters?: InputMaybe<AdminUserFiltersInput>;
  pageArgs?: InputMaybe<PaginationArgsInput>;
  sort?: InputMaybe<AdminUserSortInput>;
};


export type QueryAlgSetArgs = {
  code?: InputMaybe<Scalars['String']>;
};


export type QueryBattleChallengeArgs = {
  code?: InputMaybe<Scalars['String']>;
};


export type QueryBattleHeadToHeadArgs = {
  userId?: InputMaybe<Scalars['String']>;
};


export type QueryBattleLeaderboardArgs = {
  page?: InputMaybe<Scalars['Int']>;
  puzzle?: InputMaybe<Scalars['String']>;
  search?: InputMaybe<Scalars['String']>;
};


export type QueryBattleMatchArgs = {
  id?: InputMaybe<Scalars['String']>;
};


export type QueryBattleMatchHistoryArgs = {
  page?: InputMaybe<Scalars['Int']>;
  userId?: InputMaybe<Scalars['String']>;
};


export type QueryCaseStatsArgs = {
  cubeType?: InputMaybe<Scalars['String']>;
  lastN?: InputMaybe<Scalars['Int']>;
  sessionId?: InputMaybe<Scalars['String']>;
  subset?: InputMaybe<Scalars['String']>;
  type?: InputMaybe<Scalars['String']>;
};


export type QueryCommunityAlgSetsArgs = {
  category?: InputMaybe<Scalars['String']>;
  page?: InputMaybe<Scalars['Int']>;
  page_size?: InputMaybe<Scalars['Int']>;
  puzzle?: InputMaybe<Scalars['String']>;
  q?: InputMaybe<Scalars['String']>;
  sort?: InputMaybe<Scalars['String']>;
};


export type QueryConversationsArgs = {
  page?: InputMaybe<Scalars['Int']>;
  requests?: InputMaybe<Scalars['Boolean']>;
};


export type QueryCustomTrainerArgs = {
  id?: InputMaybe<Scalars['String']>;
};


export type QueryCustomTrainersArgs = {
  pageArgs?: InputMaybe<PaginationArgsInput>;
};


export type QueryDmPresenceArgs = {
  userIds?: InputMaybe<Array<InputMaybe<Scalars['String']>>>;
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


export type QueryMagnetTelemetryRowsArgs = {
  deviceModel?: InputMaybe<Scalars['String']>;
  eventType?: InputMaybe<Scalars['String']>;
  limit?: InputMaybe<Scalars['Int']>;
  newestFirst?: InputMaybe<Scalars['Boolean']>;
  offset?: InputMaybe<Scalars['Int']>;
  username?: InputMaybe<Scalars['String']>;
};


export type QueryMagnetTelemetrySamplesArgs = {
  id?: InputMaybe<Scalars['String']>;
};


export type QueryMagnetTelemetrySummaryArgs = {
  days?: InputMaybe<Scalars['Int']>;
};


export type QueryMediaAssetsArgs = {
  kind?: InputMaybe<MediaAssetKind>;
  limit?: InputMaybe<Scalars['Int']>;
  page?: InputMaybe<Scalars['Int']>;
  search?: InputMaybe<Scalars['String']>;
};


export type QueryMessageRecipientSearchArgs = {
  query?: InputMaybe<Scalars['String']>;
};


export type QueryMessageReportsArgs = {
  page?: InputMaybe<Scalars['Int']>;
  status?: InputMaybe<ReportStatus>;
};


export type QueryMessagesArgs = {
  before?: InputMaybe<Scalars['DateTime']>;
  conversationId?: InputMaybe<Scalars['String']>;
};


export type QueryMyBattleRatingArgs = {
  puzzle?: InputMaybe<Scalars['String']>;
};


export type QueryMyCompetitionFollowsArgs = {
  competitionId?: InputMaybe<Scalars['String']>;
};


export type QueryMyRoomSolveEntriesArgs = {
  sinceDays?: InputMaybe<Scalars['Int']>;
};


export type QueryNotificationsArgs = {
  page?: InputMaybe<Scalars['Int']>;
};


export type QueryProfileArgs = {
  username?: InputMaybe<Scalars['String']>;
};


export type QueryPublicWcaProfileArgs = {
  userId?: InputMaybe<Scalars['String']>;
};


export type QueryPublicZktProfileArgs = {
  userId?: InputMaybe<Scalars['String']>;
};


export type QueryRecoverMySolvesArgs = {
  skip?: InputMaybe<Scalars['Int']>;
  take?: InputMaybe<Scalars['Int']>;
};


export type QueryRegistrationWatchCompetitionArgs = {
  competitionId?: InputMaybe<Scalars['String']>;
};


export type QuerySmartCubeTelemetryRowsArgs = {
  cubeType?: InputMaybe<Scalars['String']>;
  eventType?: InputMaybe<Scalars['String']>;
  limit?: InputMaybe<Scalars['Int']>;
  newestFirst?: InputMaybe<Scalars['Boolean']>;
  offset?: InputMaybe<Scalars['Int']>;
  username?: InputMaybe<Scalars['String']>;
};


export type QuerySmartCubeTelemetrySummaryArgs = {
  days?: InputMaybe<Scalars['Int']>;
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


export type QuerySolveReplayDataArgs = {
  id?: InputMaybe<Scalars['String']>;
  shareCode?: InputMaybe<Scalars['String']>;
};


export type QuerySolvesArgs = {
  skip?: InputMaybe<Scalars['Int']>;
  take?: InputMaybe<Scalars['Int']>;
};


export type QuerySolvesByIdsArgs = {
  ids?: InputMaybe<Array<InputMaybe<Scalars['String']>>>;
};


export type QuerySupportTicketArgs = {
  id?: InputMaybe<Scalars['String']>;
};


export type QuerySupportTicketsArgs = {
  resolved?: InputMaybe<Scalars['Boolean']>;
};


export type QueryTopAveragesArgs = {
  cubeType?: InputMaybe<Scalars['String']>;
  page?: InputMaybe<Scalars['Int']>;
  scrambleSubset?: InputMaybe<Scalars['String']>;
};


export type QueryTopSolvesArgs = {
  cubeType?: InputMaybe<Scalars['String']>;
  page?: InputMaybe<Scalars['Int']>;
  scrambleSubset?: InputMaybe<Scalars['String']>;
};


export type QueryTrainerAlternativesArgs = {
  caseName?: InputMaybe<Scalars['String']>;
  category?: InputMaybe<Scalars['String']>;
};


export type QueryTrainerLibraryArgs = {
  knownVersion?: InputMaybe<Scalars['String']>;
};


export type QueryTrainerLibraryAlternativesArgs = {
  category?: InputMaybe<Scalars['String']>;
};


export type QueryUserBattleRatingArgs = {
  puzzle?: InputMaybe<Scalars['String']>;
  userId?: InputMaybe<Scalars['String']>;
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


export type QueryZktPersonBestsArgs = {
  zktId?: InputMaybe<Scalars['String']>;
};


export type QueryZktPublicCompetitionArgs = {
  id?: InputMaybe<Scalars['String']>;
};


export type QueryZktPublicCompetitionsArgs = {
  page?: InputMaybe<Scalars['Int']>;
  pageSize?: InputMaybe<Scalars['Int']>;
  q?: InputMaybe<Scalars['String']>;
};


export type QueryZktPublicCompetitorArgs = {
  competitionId?: InputMaybe<Scalars['String']>;
  key?: InputMaybe<Scalars['String']>;
};


export type QueryZktPublicGroupAssignmentsArgs = {
  competitionId?: InputMaybe<Scalars['String']>;
  groupId?: InputMaybe<Scalars['String']>;
};


export type QueryZktPublicRoundResultsArgs = {
  competitionId?: InputMaybe<Scalars['String']>;
  roundId?: InputMaybe<Scalars['String']>;
};

export type RecordWatch = {
  __typename?: 'RecordWatch';
  created_at?: Maybe<Scalars['DateTime']>;
  enabled?: Maybe<Scalars['Boolean']>;
  events?: Maybe<Array<Maybe<Scalars['String']>>>;
  id?: Maybe<Scalars['String']>;
  region?: Maybe<Scalars['String']>;
  scope?: Maybe<Scalars['String']>;
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

export type RegistrationWatchCompetitionRow = {
  __typename?: 'RegistrationWatchCompetitionRow';
  accepted_count?: Maybe<Scalars['Int']>;
  baseline_at?: Maybe<Scalars['DateTime']>;
  competition_id?: Maybe<Scalars['String']>;
  competitor_limit?: Maybe<Scalars['Int']>;
  confirmed_at?: Maybe<Scalars['DateTime']>;
  end_date?: Maybe<Scalars['String']>;
  event_count?: Maybe<Scalars['Int']>;
  flagged_count?: Maybe<Scalars['Int']>;
  groups_seen_at?: Maybe<Scalars['DateTime']>;
  last_event_at?: Maybe<Scalars['DateTime']>;
  name?: Maybe<Scalars['String']>;
  registration_close?: Maybe<Scalars['DateTime']>;
  start_date?: Maybe<Scalars['String']>;
};

export type RegistrationWatchDetail = {
  __typename?: 'RegistrationWatchDetail';
  competition?: Maybe<RegistrationWatchCompetitionRow>;
  events?: Maybe<Array<Maybe<RegistrationWatchEventRow>>>;
  registrants?: Maybe<Array<Maybe<RegistrationWatchRegistrantRow>>>;
};

export type RegistrationWatchEventRow = {
  __typename?: 'RegistrationWatchEventRow';
  after_close?: Maybe<Scalars['Boolean']>;
  after_groups?: Maybe<Scalars['Boolean']>;
  events_after?: Maybe<Array<Maybe<Scalars['String']>>>;
  events_before?: Maybe<Array<Maybe<Scalars['String']>>>;
  id?: Maybe<Scalars['String']>;
  kind?: Maybe<Scalars['String']>;
  name?: Maybe<Scalars['String']>;
  observed_at?: Maybe<Scalars['DateTime']>;
  registrant_id?: Maybe<Scalars['Int']>;
  wca_id?: Maybe<Scalars['String']>;
  wca_registration_id?: Maybe<Scalars['Int']>;
  window_start?: Maybe<Scalars['DateTime']>;
};

export type RegistrationWatchRegistrantRow = {
  __typename?: 'RegistrationWatchRegistrantRow';
  competitor_groups?: Maybe<Scalars['Int']>;
  event_ids?: Maybe<Array<Maybe<Scalars['String']>>>;
  first_seen_at?: Maybe<Scalars['DateTime']>;
  name?: Maybe<Scalars['String']>;
  registrant_id?: Maybe<Scalars['Int']>;
  staff_tasks?: Maybe<Scalars['Int']>;
  unstaffed?: Maybe<Scalars['Boolean']>;
  wca_id?: Maybe<Scalars['String']>;
  wca_registration_id?: Maybe<Scalars['Int']>;
};

export type ReindexEsResult = {
  __typename?: 'ReindexESResult';
  failed?: Maybe<Scalars['Int']>;
  indexed?: Maybe<Scalars['Int']>;
  total?: Maybe<Scalars['Int']>;
};

export type ReindexLlResult = {
  __typename?: 'ReindexLLResult';
  failed?: Maybe<Scalars['Int']>;
  ollUpdated?: Maybe<Scalars['Int']>;
  pllUpdated?: Maybe<Scalars['Int']>;
  scanned?: Maybe<Scalars['Int']>;
  total?: Maybe<Scalars['Int']>;
};

export type ReplyPreview = {
  __typename?: 'ReplyPreview';
  body?: Maybe<Scalars['String']>;
  deleted_at?: Maybe<Scalars['DateTime']>;
  id?: Maybe<Scalars['String']>;
  sender?: Maybe<ReplyPreviewSender>;
  sender_id?: Maybe<Scalars['String']>;
  solve_id?: Maybe<Scalars['String']>;
};

export type ReplyPreviewSender = {
  __typename?: 'ReplyPreviewSender';
  username?: Maybe<Scalars['String']>;
};

export type Report = {
  __typename?: 'Report';
  alg_set?: Maybe<ReportAlgSet>;
  alg_set_id?: Maybe<Scalars['String']>;
  created_at?: Maybe<Scalars['DateTime']>;
  created_by?: Maybe<PublicUserAccount>;
  created_by_id?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  reason?: Maybe<Scalars['String']>;
  reported_user?: Maybe<PublicUserAccount>;
  reported_user_id?: Maybe<Scalars['String']>;
  resolved_at?: Maybe<Scalars['DateTime']>;
};

export type ReportAlgSet = {
  __typename?: 'ReportAlgSet';
  code?: Maybe<Scalars['String']>;
  hidden?: Maybe<Scalars['Boolean']>;
  hidden_reason?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  name?: Maybe<Scalars['String']>;
  visibility?: Maybe<Scalars['String']>;
};

export type ReportSnapshotMessage = {
  __typename?: 'ReportSnapshotMessage';
  body?: Maybe<Scalars['String']>;
  created_at?: Maybe<Scalars['String']>;
  has_solve?: Maybe<Scalars['Boolean']>;
  id?: Maybe<Scalars['String']>;
  sender_id?: Maybe<Scalars['String']>;
  sender_username?: Maybe<Scalars['String']>;
};

/** Moderation state of a conversation report */
export enum ReportStatus {
  Actioned = 'ACTIONED',
  Dismissed = 'DISMISSED',
  Open = 'OPEN'
}

export type ReportSummary = {
  __typename?: 'ReportSummary';
  count?: Maybe<Scalars['Int']>;
  first_report?: Maybe<Scalars['DateTime']>;
  last_report?: Maybe<Scalars['DateTime']>;
  reports?: Maybe<Array<Maybe<Report>>>;
  user?: Maybe<PublicUserAccount>;
};

export type RoomSolveEntry = {
  __typename?: 'RoomSolveEntry';
  created_at?: Maybe<Scalars['Float']>;
  cube_type?: Maybe<Scalars['String']>;
};

export type SavedAlgSet = {
  __typename?: 'SavedAlgSet';
  saved_at?: Maybe<Scalars['DateTime']>;
  set?: Maybe<AlgSetSummary>;
  set_id?: Maybe<Scalars['String']>;
  unavailable?: Maybe<Scalars['Boolean']>;
};

export type SaveRecordWatchInput = {
  events?: InputMaybe<Array<InputMaybe<Scalars['String']>>>;
  region?: InputMaybe<Scalars['String']>;
  scope?: InputMaybe<Scalars['String']>;
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
  id?: Maybe<Scalars['String']>;
  name?: Maybe<Scalars['String']>;
  order?: Maybe<Scalars['Float']>;
  user_id?: Maybe<Scalars['String']>;
};

export type SessionBucketInput = {
  cube_type?: InputMaybe<Scalars['String']>;
  scramble_subset?: InputMaybe<Scalars['String']>;
};

export type SessionInput = {
  id?: InputMaybe<Scalars['String']>;
  name?: InputMaybe<Scalars['String']>;
  order?: InputMaybe<Scalars['Float']>;
};

export type SetDailyGoalInput = {
  cube_type?: InputMaybe<Scalars['String']>;
  enabled?: InputMaybe<Scalars['Boolean']>;
  scramble_subset?: InputMaybe<Scalars['String']>;
  target?: InputMaybe<Scalars['Int']>;
};

export type Setting = {
  __typename?: 'Setting';
  confirm_delete_season?: Maybe<Scalars['Boolean']>;
  confirm_delete_solve?: Maybe<Scalars['Boolean']>;
  created_at?: Maybe<Scalars['DateTime']>;
  cube_type?: Maybe<Scalars['String']>;
  custom_cube_types?: Maybe<Array<Maybe<CustomCubeType>>>;
  desktop_prefs?: Maybe<Scalars['String']>;
  focus_mode?: Maybe<Scalars['Boolean']>;
  freeze_time?: Maybe<Scalars['Float']>;
  hide_time_when_solving?: Maybe<Scalars['Boolean']>;
  id?: Maybe<Scalars['String']>;
  inspection?: Maybe<Scalars['Boolean']>;
  inspection_delay?: Maybe<Scalars['Int']>;
  inverse_time_list?: Maybe<Scalars['Boolean']>;
  manual_entry?: Maybe<Scalars['Boolean']>;
  mobile_prefs?: Maybe<Scalars['String']>;
  nav_collapsed?: Maybe<Scalars['Boolean']>;
  pb_confetti?: Maybe<Scalars['Boolean']>;
  play_inspection_sound?: Maybe<Scalars['Boolean']>;
  require_period_in_manual_time_entry?: Maybe<Scalars['Boolean']>;
  scramble_subset?: Maybe<Scalars['String']>;
  scramble_top_color?: Maybe<Scalars['String']>;
  session_id?: Maybe<Scalars['String']>;
  smart_cube_size?: Maybe<Scalars['Int']>;
  smart_cube_size_user_default?: Maybe<Scalars['Int']>;
  timer_decimal_points?: Maybe<Scalars['Int']>;
  timer_scramble_size_user_default?: Maybe<Scalars['Int']>;
  timer_time_size_user_default?: Maybe<Scalars['Int']>;
  trainer_options?: Maybe<Scalars['String']>;
  use_2d_scramble_visual?: Maybe<Scalars['Boolean']>;
  use_space_with_smart_cube?: Maybe<Scalars['Boolean']>;
  user_id?: Maybe<Scalars['String']>;
  zero_out_time_after_solve?: Maybe<Scalars['Boolean']>;
};

export type SettingInput = {
  confirm_delete_season?: InputMaybe<Scalars['Boolean']>;
  confirm_delete_solve?: InputMaybe<Scalars['Boolean']>;
  cube_type?: InputMaybe<Scalars['String']>;
  desktop_prefs?: InputMaybe<Scalars['String']>;
  focus_mode?: InputMaybe<Scalars['Boolean']>;
  freeze_time?: InputMaybe<Scalars['Float']>;
  hide_time_when_solving?: InputMaybe<Scalars['Boolean']>;
  inspection?: InputMaybe<Scalars['Boolean']>;
  inspection_delay?: InputMaybe<Scalars['Int']>;
  inverse_time_list?: InputMaybe<Scalars['Boolean']>;
  locale?: InputMaybe<Scalars['String']>;
  manual_entry?: InputMaybe<Scalars['Boolean']>;
  mobile_prefs?: InputMaybe<Scalars['String']>;
  nav_collapsed?: InputMaybe<Scalars['Boolean']>;
  pb_confetti?: InputMaybe<Scalars['Boolean']>;
  play_inspection_sound?: InputMaybe<Scalars['Boolean']>;
  require_period_in_manual_time_entry?: InputMaybe<Scalars['Boolean']>;
  scramble_subset?: InputMaybe<Scalars['String']>;
  scramble_top_color?: InputMaybe<Scalars['String']>;
  session_id?: InputMaybe<Scalars['String']>;
  smart_cube_size?: InputMaybe<Scalars['Int']>;
  smart_cube_size_user_default?: InputMaybe<Scalars['Int']>;
  timer_decimal_points?: InputMaybe<Scalars['Int']>;
  timer_scramble_size_user_default?: InputMaybe<Scalars['Int']>;
  timer_time_size_user_default?: InputMaybe<Scalars['Int']>;
  trainer_options?: InputMaybe<Scalars['String']>;
  use_2d_scramble_visual?: InputMaybe<Scalars['Boolean']>;
  use_space_with_smart_cube?: InputMaybe<Scalars['Boolean']>;
  zero_out_time_after_solve?: InputMaybe<Scalars['Boolean']>;
};

export type SiteConfig = {
  __typename?: 'SiteConfig';
  battle_enabled?: Maybe<Scalars['Boolean']>;
  community_enabled?: Maybe<Scalars['Boolean']>;
  featureOverrides?: Maybe<Array<Maybe<FeatureOverrideEntry>>>;
  id?: Maybe<Scalars['String']>;
  leaderboards_enabled?: Maybe<Scalars['Boolean']>;
  magnet_telemetry_enabled?: Maybe<Scalars['Boolean']>;
  maintenance_mode?: Maybe<Scalars['Boolean']>;
  messaging_enabled?: Maybe<Scalars['Boolean']>;
  method_steps_version?: Maybe<Scalars['Int']>;
  online_battle_enabled?: Maybe<Scalars['Boolean']>;
  presence_enabled?: Maybe<Scalars['Boolean']>;
  pro_enabled?: Maybe<Scalars['Boolean']>;
  rooms_enabled?: Maybe<Scalars['Boolean']>;
  smart_telemetry_enabled?: Maybe<Scalars['Boolean']>;
  trainer_enabled?: Maybe<Scalars['Boolean']>;
  updated_at?: Maybe<Scalars['DateTime']>;
  wca_backfill_enabled?: Maybe<Scalars['Boolean']>;
  zkt_backfill_enabled?: Maybe<Scalars['Boolean']>;
};

export type SmartCubeTelemetryInput = {
  app_version?: InputMaybe<Scalars['String']>;
  battery_level?: InputMaybe<Scalars['Int']>;
  cube_type?: InputMaybe<Scalars['String']>;
  detection_lag_ms?: InputMaybe<Scalars['Int']>;
  detection_source?: InputMaybe<Scalars['String']>;
  device_name?: InputMaybe<Scalars['String']>;
  event_type?: InputMaybe<Scalars['String']>;
  is_native?: InputMaybe<Scalars['Boolean']>;
  recovered_moves?: InputMaybe<Scalars['Int']>;
  surface?: InputMaybe<Scalars['String']>;
  time_correction_ms?: InputMaybe<Scalars['Int']>;
  time_ms?: InputMaybe<Scalars['Int']>;
  turn_count?: InputMaybe<Scalars['Int']>;
};

export type SmartCubeTelemetryResult = {
  __typename?: 'SmartCubeTelemetryResult';
  accepted?: Maybe<Scalars['Int']>;
};

export type SmartCubeTelemetryRow = {
  __typename?: 'SmartCubeTelemetryRow';
  app_version?: Maybe<Scalars['String']>;
  battery_level?: Maybe<Scalars['Int']>;
  created_at?: Maybe<Scalars['DateTime']>;
  cube_type?: Maybe<Scalars['String']>;
  detection_lag_ms?: Maybe<Scalars['Int']>;
  detection_source?: Maybe<Scalars['String']>;
  device_name?: Maybe<Scalars['String']>;
  event_type?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  is_native?: Maybe<Scalars['Boolean']>;
  recovered_moves?: Maybe<Scalars['Int']>;
  surface?: Maybe<Scalars['String']>;
  time_correction_ms?: Maybe<Scalars['Int']>;
  time_ms?: Maybe<Scalars['Int']>;
  turn_count?: Maybe<Scalars['Int']>;
  user_id?: Maybe<Scalars['String']>;
  username?: Maybe<Scalars['String']>;
};

export type SmartCubeTelemetrySummary = {
  __typename?: 'SmartCubeTelemetrySummary';
  avg_battery_clean?: Maybe<Scalars['Int']>;
  avg_battery_recovered?: Maybe<Scalars['Int']>;
  avg_recovered_moves?: Maybe<Scalars['Float']>;
  cube_type?: Maybe<Scalars['String']>;
  device_name?: Maybe<Scalars['String']>;
  distinct_users?: Maybe<Scalars['Int']>;
  late_scramble_events?: Maybe<Scalars['Int']>;
  median_lag_ms?: Maybe<Scalars['Int']>;
  median_time_correction_ms?: Maybe<Scalars['Int']>;
  out_of_sync_events?: Maybe<Scalars['Int']>;
  p95_lag_ms?: Maybe<Scalars['Int']>;
  scramble_realign_events?: Maybe<Scalars['Int']>;
  scramble_reset_events?: Maybe<Scalars['Int']>;
  solves?: Maybe<Scalars['Int']>;
  via_grace?: Maybe<Scalars['Int']>;
  via_poll?: Maybe<Scalars['Int']>;
  via_tracker?: Maybe<Scalars['Int']>;
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

export type SocialPreference = {
  __typename?: 'SocialPreference';
  dm_policy?: Maybe<DmPolicy>;
  dm_push?: Maybe<Scalars['Boolean']>;
  online_status?: Maybe<Scalars['Boolean']>;
  read_receipts?: Maybe<Scalars['Boolean']>;
  searchable?: Maybe<Scalars['Boolean']>;
  typing_indicator?: Maybe<Scalars['Boolean']>;
};

export type Solve = {
  __typename?: 'Solve';
  bulk?: Maybe<Scalars['Boolean']>;
  created_at?: Maybe<Scalars['DateTime']>;
  cube?: Maybe<SolveCube>;
  cube_id?: Maybe<Scalars['String']>;
  cube_type?: Maybe<Scalars['String']>;
  dnf?: Maybe<Scalars['Boolean']>;
  ended_at?: Maybe<Scalars['BigInt']>;
  from_timer?: Maybe<Scalars['Boolean']>;
  id?: Maybe<Scalars['String']>;
  inspection_time?: Maybe<Scalars['Float']>;
  is_smart_cube?: Maybe<Scalars['Boolean']>;
  is_virtual_cube?: Maybe<Scalars['Boolean']>;
  notes?: Maybe<Scalars['String']>;
  phase_splits?: Maybe<Scalars['String']>;
  plus_two?: Maybe<Scalars['Boolean']>;
  raw_time?: Maybe<Scalars['Float']>;
  scramble?: Maybe<Scalars['String']>;
  scramble_subset?: Maybe<Scalars['String']>;
  session_id?: Maybe<Scalars['String']>;
  share_code?: Maybe<Scalars['String']>;
  smart_device?: Maybe<SmartDevice>;
  smart_device_id?: Maybe<Scalars['String']>;
  smart_pick_up_time?: Maybe<Scalars['Float']>;
  smart_put_down_time?: Maybe<Scalars['Float']>;
  smart_rotations?: Maybe<Scalars['String']>;
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

export type SolveCube = {
  __typename?: 'SolveCube';
  brand?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  is_smart?: Maybe<Scalars['Boolean']>;
  name?: Maybe<Scalars['String']>;
  puzzle?: Maybe<Scalars['String']>;
};

export type SolveInput = {
  analysis_method?: InputMaybe<Scalars['String']>;
  bulk?: InputMaybe<Scalars['Boolean']>;
  cube_id?: InputMaybe<Scalars['String']>;
  cube_type?: InputMaybe<Scalars['String']>;
  dnf?: InputMaybe<Scalars['Boolean']>;
  ended_at?: InputMaybe<Scalars['BigInt']>;
  from_timer?: InputMaybe<Scalars['Boolean']>;
  id?: InputMaybe<Scalars['String']>;
  inspection_time?: InputMaybe<Scalars['Float']>;
  is_smart_cube?: InputMaybe<Scalars['Boolean']>;
  is_virtual_cube?: InputMaybe<Scalars['Boolean']>;
  notes?: InputMaybe<Scalars['String']>;
  phase_splits?: InputMaybe<Scalars['String']>;
  plus_two?: InputMaybe<Scalars['Boolean']>;
  raw_time?: InputMaybe<Scalars['Float']>;
  scramble?: InputMaybe<Scalars['String']>;
  scramble_subset?: InputMaybe<Scalars['String']>;
  session_id?: InputMaybe<Scalars['String']>;
  smart_device_id?: InputMaybe<Scalars['String']>;
  smart_gyro?: InputMaybe<Scalars['String']>;
  smart_pick_up_time?: InputMaybe<Scalars['Float']>;
  smart_put_down_time?: InputMaybe<Scalars['Float']>;
  smart_rotations?: InputMaybe<Scalars['String']>;
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
  case_key?: Maybe<Scalars['String']>;
  case_set?: Maybe<Scalars['String']>;
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

export type SolveReplayData = {
  __typename?: 'SolveReplayData';
  is_owner?: Maybe<Scalars['Boolean']>;
  reconstruction_vote?: Maybe<Scalars['Int']>;
  smart_gyro?: Maybe<Scalars['String']>;
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

export type SupportTicket = {
  __typename?: 'SupportTicket';
  admin_read_at?: Maybe<Scalars['DateTime']>;
  created_at?: Maybe<Scalars['DateTime']>;
  created_by?: Maybe<PublicUserAccount>;
  created_by_id?: Maybe<Scalars['String']>;
  device_info?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  message?: Maybe<Scalars['String']>;
  messages?: Maybe<Array<SupportTicketMessage>>;
  resolved_at?: Maybe<Scalars['DateTime']>;
  subject?: Maybe<Scalars['String']>;
  user_read_at?: Maybe<Scalars['DateTime']>;
};

export type SupportTicketAttachment = {
  __typename?: 'SupportTicketAttachment';
  created_at?: Maybe<Scalars['DateTime']>;
  id?: Maybe<Scalars['String']>;
  kind?: Maybe<Scalars['String']>;
  message_id?: Maybe<Scalars['String']>;
  mime_type?: Maybe<Scalars['String']>;
  original_name?: Maybe<Scalars['String']>;
  size_bytes?: Maybe<Scalars['Int']>;
  storage_path?: Maybe<Scalars['String']>;
};

export type SupportTicketInput = {
  device_info?: InputMaybe<Scalars['String']>;
  message?: InputMaybe<Scalars['String']>;
  subject?: InputMaybe<Scalars['String']>;
};

export type SupportTicketMessage = {
  __typename?: 'SupportTicketMessage';
  attachments?: Maybe<Array<SupportTicketAttachment>>;
  body?: Maybe<Scalars['String']>;
  created_at?: Maybe<Scalars['DateTime']>;
  id?: Maybe<Scalars['String']>;
  is_admin?: Maybe<Scalars['Boolean']>;
  sender?: Maybe<PublicUserAccount>;
  sender_id?: Maybe<Scalars['String']>;
  ticket_id?: Maybe<Scalars['String']>;
};

export type TimerBackground = {
  __typename?: 'TimerBackground';
  created_at?: Maybe<Scalars['DateTime']>;
  hex?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  media_type?: Maybe<Scalars['String']>;
  mobile_media_type?: Maybe<Scalars['String']>;
  mobile_same_as_desktop?: Maybe<Scalars['Boolean']>;
  mobile_storage_path?: Maybe<Scalars['String']>;
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
  scramble_subset?: Maybe<Scalars['String']>;
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
  scramble_subset?: Maybe<Scalars['String']>;
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

export type TrainerCaseAlternatives = {
  __typename?: 'TrainerCaseAlternatives';
  alternatives?: Maybe<Array<Maybe<Scalars['String']>>>;
  name?: Maybe<Scalars['String']>;
};

export type TrainerFavorite = {
  __typename?: 'TrainerFavorite';
  created_at?: Maybe<Scalars['DateTime']>;
  cube_key?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  user_id?: Maybe<Scalars['String']>;
};

export type TrainerLibrary = {
  __typename?: 'TrainerLibrary';
  categories?: Maybe<Array<TrainerLibraryCategory>>;
  version?: Maybe<Scalars['String']>;
};

export type TrainerLibraryAlternatives = {
  __typename?: 'TrainerLibraryAlternatives';
  cases?: Maybe<Array<Maybe<TrainerCaseAlternatives>>>;
  category?: Maybe<Scalars['String']>;
  version?: Maybe<Scalars['String']>;
};

export type TrainerLibraryCategory = {
  __typename?: 'TrainerLibraryCategory';
  category?: Maybe<Scalars['String']>;
  subsets?: Maybe<Array<Maybe<TrainerLibrarySubset>>>;
};

export type TrainerLibraryEntry = {
  __typename?: 'TrainerLibraryEntry';
  algorithm?: Maybe<Scalars['String']>;
  alternativeCount?: Maybe<Scalars['Int']>;
  name?: Maybe<Scalars['String']>;
  setup?: Maybe<Scalars['String']>;
};

export type TrainerLibrarySubset = {
  __typename?: 'TrainerLibrarySubset';
  algorithms?: Maybe<Array<Maybe<TrainerLibraryEntry>>>;
  subset?: Maybe<Scalars['String']>;
};

export type TranslateAnnouncementResult = {
  __typename?: 'TranslateAnnouncementResult';
  content?: Maybe<TranslatedText>;
  title?: Maybe<TranslatedText>;
};

export type TranslatedText = {
  __typename?: 'TranslatedText';
  en?: Maybe<Scalars['String']>;
  es?: Maybe<Scalars['String']>;
  ru?: Maybe<Scalars['String']>;
  zh?: Maybe<Scalars['String']>;
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
  showInApp?: InputMaybe<Scalars['Boolean']>;
  targetUrl?: InputMaybe<Scalars['String']>;
  title?: InputMaybe<Scalars['String']>;
  translations?: InputMaybe<Scalars['String']>;
};

export type UpdateSiteConfigInput = {
  battle_enabled?: InputMaybe<Scalars['Boolean']>;
  community_enabled?: InputMaybe<Scalars['Boolean']>;
  featureOverrides?: InputMaybe<Array<FeatureOverrideEntryInput>>;
  leaderboards_enabled?: InputMaybe<Scalars['Boolean']>;
  magnet_telemetry_enabled?: InputMaybe<Scalars['Boolean']>;
  maintenance_mode?: InputMaybe<Scalars['Boolean']>;
  messaging_enabled?: InputMaybe<Scalars['Boolean']>;
  online_battle_enabled?: InputMaybe<Scalars['Boolean']>;
  presence_enabled?: InputMaybe<Scalars['Boolean']>;
  pro_enabled?: InputMaybe<Scalars['Boolean']>;
  rooms_enabled?: InputMaybe<Scalars['Boolean']>;
  smart_telemetry_enabled?: InputMaybe<Scalars['Boolean']>;
  trainer_enabled?: InputMaybe<Scalars['Boolean']>;
  wca_backfill_enabled?: InputMaybe<Scalars['Boolean']>;
  zkt_backfill_enabled?: InputMaybe<Scalars['Boolean']>;
};

export type UpdateSocialPreferenceInput = {
  dm_policy?: InputMaybe<DmPolicy>;
  dm_push?: InputMaybe<Scalars['Boolean']>;
  online_status?: InputMaybe<Scalars['Boolean']>;
  read_receipts?: InputMaybe<Scalars['Boolean']>;
  searchable?: InputMaybe<Scalars['Boolean']>;
  typing_indicator?: InputMaybe<Scalars['Boolean']>;
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
  email_verified?: Maybe<Scalars['Boolean']>;
  first_name?: Maybe<Scalars['String']>;
  has_password?: Maybe<Scalars['Boolean']>;
  id?: Maybe<Scalars['String']>;
  integrations?: Maybe<Array<Maybe<Integration>>>;
  is_premium?: Maybe<Scalars['Boolean']>;
  is_pro?: Maybe<Scalars['Boolean']>;
  join_country?: Maybe<Scalars['String']>;
  last_name?: Maybe<Scalars['String']>;
  last_seen_at?: Maybe<Scalars['DateTime']>;
  last_solve_at?: Maybe<Scalars['DateTime']>;
  mod?: Maybe<Scalars['Boolean']>;
  offline_hash?: Maybe<Scalars['String']>;
  pending_email?: Maybe<Scalars['String']>;
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
  iap_billing_issue_at?: Maybe<Scalars['DateTime']>;
  iap_cancellation_at?: Maybe<Scalars['DateTime']>;
  iap_latest_event_at?: Maybe<Scalars['DateTime']>;
  iap_paused_until?: Maybe<Scalars['DateTime']>;
  iap_platform?: Maybe<Scalars['String']>;
  iap_product_id?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  integrations?: Maybe<Array<Maybe<Integration>>>;
  is_premium?: Maybe<Scalars['Boolean']>;
  is_pro?: Maybe<Scalars['Boolean']>;
  join_country?: Maybe<Scalars['String']>;
  join_ip?: Maybe<Scalars['String']>;
  last_name?: Maybe<Scalars['String']>;
  last_seen_at?: Maybe<Scalars['DateTime']>;
  last_solve_at?: Maybe<Scalars['DateTime']>;
  mod?: Maybe<Scalars['Boolean']>;
  notification_preferences?: Maybe<NotificationPreference>;
  offline_hash?: Maybe<Scalars['String']>;
  pending_email?: Maybe<Scalars['String']>;
  premium_expires_at?: Maybe<Scalars['DateTime']>;
  pro_expires_at?: Maybe<Scalars['DateTime']>;
  profile?: Maybe<Profile>;
  pushTokens?: Maybe<Array<PushTokenInfo>>;
  reports_for?: Maybe<Array<Maybe<Report>>>;
  revenuecat_user_id?: Maybe<Scalars['String']>;
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
  scramble_subset?: Maybe<Scalars['String']>;
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

export type UserDailyActivityResult = {
  __typename?: 'UserDailyActivityResult';
  rows?: Maybe<Array<Maybe<UserPageActivityRow>>>;
  total_minutes?: Maybe<Scalars['Int']>;
};

export type UserPageActivityRow = {
  __typename?: 'UserPageActivityRow';
  minutes?: Maybe<Scalars['Int']>;
  path?: Maybe<Scalars['String']>;
};

export type VoidBattleMatchResult = {
  __typename?: 'VoidBattleMatchResult';
  changed?: Maybe<Scalars['Boolean']>;
  match_id?: Maybe<Scalars['String']>;
  reverted_a?: Maybe<Scalars['Boolean']>;
  reverted_b?: Maybe<Scalars['Boolean']>;
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

export type WcaCompetitionDay = {
  __typename?: 'WcaCompetitionDay';
  date?: Maybe<Scalars['String']>;
  label?: Maybe<Scalars['String']>;
  named?: Maybe<Scalars['Boolean']>;
  position?: Maybe<Scalars['Int']>;
};

export type WcaCompetitionDetail = {
  __typename?: 'WcaCompetitionDetail';
  allPersonalBests?: Maybe<Array<Maybe<WcaRankingRow>>>;
  competitionId?: Maybe<Scalars['String']>;
  competitionName?: Maybe<Scalars['String']>;
  competitors?: Maybe<Array<Maybe<WcaCompetitor>>>;
  days?: Maybe<Array<WcaCompetitionDay>>;
  events?: Maybe<Array<Maybe<WcaEventDetail>>>;
  info?: Maybe<WcaCompetitionInfo>;
  myDayLabel?: Maybe<Scalars['String']>;
  myRegisteredEvents?: Maybe<Array<Maybe<Scalars['String']>>>;
  myRegistrantId?: Maybe<Scalars['Int']>;
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
  dayLabel?: Maybe<Scalars['String']>;
  name?: Maybe<Scalars['String']>;
  personalBests?: Maybe<Array<Maybe<WcaPersonalBest>>>;
  registeredEvents?: Maybe<Array<Maybe<Scalars['String']>>>;
  registrantId?: Maybe<Scalars['Int']>;
  wcaId?: Maybe<Scalars['String']>;
  wcaUserId?: Maybe<Scalars['Int']>;
  zktId?: Maybe<Scalars['String']>;
};

export type WcaCompetitorAssignment = {
  __typename?: 'WcaCompetitorAssignment';
  activityCode?: Maybe<Scalars['String']>;
  assignmentCode?: Maybe<Scalars['String']>;
  chance?: Maybe<Scalars['Int']>;
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
  dayLabel?: Maybe<Scalars['String']>;
  eventId?: Maybe<Scalars['String']>;
  eventName?: Maybe<Scalars['String']>;
  rounds?: Maybe<Array<Maybe<WcaRound>>>;
};

export type WcaGroup = {
  __typename?: 'WcaGroup';
  activityCode?: Maybe<Scalars['String']>;
  chance?: Maybe<Scalars['Int']>;
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

export type WcaLiveChance = {
  __typename?: 'WcaLiveChance';
  attempts?: Maybe<Array<Maybe<WcaLiveAttempt>>>;
  average?: Maybe<Scalars['Int']>;
  best?: Maybe<Scalars['Int']>;
  chance?: Maybe<Scalars['Int']>;
  counting?: Maybe<Scalars['Boolean']>;
  noShow?: Maybe<Scalars['Boolean']>;
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
  name?: Maybe<Scalars['String']>;
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
  chances?: Maybe<Array<WcaLiveChance>>;
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
  dayIndex?: Maybe<Scalars['Int']>;
  dayLabel?: Maybe<Scalars['String']>;
  dualChance?: Maybe<Scalars['Boolean']>;
  finished?: Maybe<Scalars['Boolean']>;
  format?: Maybe<WcaLiveFormat>;
  isFinal?: Maybe<Scalars['Boolean']>;
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
  dualChance?: Maybe<Scalars['Boolean']>;
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
  chance?: Maybe<Scalars['Int']>;
  dayIndex?: Maybe<Scalars['Int']>;
  dayLabel?: Maybe<Scalars['String']>;
  endTime?: Maybe<Scalars['String']>;
  isFinal?: Maybe<Scalars['Boolean']>;
  name?: Maybe<Scalars['String']>;
  roundNumber?: Maybe<Scalars['Int']>;
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
  pendingToken?: Maybe<Scalars['String']>;
  sessionToken?: Maybe<Scalars['String']>;
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

export type WcaRecentRecord = {
  __typename?: 'WcaRecentRecord';
  attemptResult?: Maybe<Scalars['Int']>;
  competitionId?: Maybe<Scalars['String']>;
  competitionName?: Maybe<Scalars['String']>;
  eventId?: Maybe<Scalars['String']>;
  eventName?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  personCountryIso2?: Maybe<Scalars['String']>;
  personName?: Maybe<Scalars['String']>;
  roundNumber?: Maybe<Scalars['Int']>;
  tag?: Maybe<Scalars['String']>;
  type?: Maybe<Scalars['String']>;
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
  dualChance?: Maybe<Scalars['Boolean']>;
  format?: Maybe<Scalars['String']>;
  groups?: Maybe<Array<Maybe<WcaGroup>>>;
  roundNumber?: Maybe<Scalars['Int']>;
  timeLimit?: Maybe<Scalars['Int']>;
};

export type WcaScheduleAssignment = {
  __typename?: 'WcaScheduleAssignment';
  activityCode?: Maybe<Scalars['String']>;
  assignmentCode?: Maybe<Scalars['String']>;
  chance?: Maybe<Scalars['Int']>;
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

export type WcaStats = {
  __typename?: 'WcaStats';
  bothConnected?: Maybe<Scalars['Int']>;
  totalUsers?: Maybe<Scalars['Int']>;
  wcaBackfillPending?: Maybe<Scalars['Int']>;
  wcaConnected?: Maybe<Scalars['Int']>;
  wcaRevoked?: Maybe<Scalars['Int']>;
  wcaWithId?: Maybe<Scalars['Int']>;
  wcaWithoutId?: Maybe<Scalars['Int']>;
  wcaWithoutUserId?: Maybe<Scalars['Int']>;
  zktConnected?: Maybe<Scalars['Int']>;
  zktRevoked?: Maybe<Scalars['Int']>;
  zktWithId?: Maybe<Scalars['Int']>;
  zktWithoutId?: Maybe<Scalars['Int']>;
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

export type ZktBackfillResult = {
  __typename?: 'ZktBackfillResult';
  conflict?: Maybe<Scalars['Int']>;
  error?: Maybe<Scalars['Int']>;
  filled?: Maybe<Scalars['Int']>;
  stillNull?: Maybe<Scalars['Int']>;
  total?: Maybe<Scalars['Int']>;
};

export type ZktEventPb = {
  __typename?: 'ZktEventPb';
  average?: Maybe<Scalars['String']>;
  event_id?: Maybe<Scalars['String']>;
  single?: Maybe<Scalars['String']>;
};

export type ZktOAuthResult = {
  __typename?: 'ZktOAuthResult';
  needsUsername?: Maybe<Scalars['Boolean']>;
  pendingToken?: Maybe<Scalars['String']>;
  sessionToken?: Maybe<Scalars['String']>;
  success?: Maybe<Scalars['Boolean']>;
  zktEmail?: Maybe<Scalars['String']>;
  zktId?: Maybe<Scalars['String']>;
  zktMemberNo?: Maybe<Scalars['Float']>;
  zktName?: Maybe<Scalars['String']>;
};

export type ZktPublicAttemptResult = {
  __typename?: 'ZktPublicAttemptResult';
  advancing?: Maybe<Scalars['Boolean']>;
  attempts?: Maybe<Array<Maybe<Scalars['Int']>>>;
  average?: Maybe<Scalars['Int']>;
  best?: Maybe<Scalars['Int']>;
  chances?: Maybe<Array<ZktPublicChance>>;
  clinched?: Maybe<Scalars['Boolean']>;
  competitor?: Maybe<ZktPublicCompetitor>;
  questionable?: Maybe<Scalars['Boolean']>;
  ranking?: Maybe<Scalars['Int']>;
  recordTags?: Maybe<ZktPublicRecordTags>;
};

export type ZktPublicChance = {
  __typename?: 'ZktPublicChance';
  attempts?: Maybe<Array<Maybe<Scalars['Int']>>>;
  average?: Maybe<Scalars['Int']>;
  best?: Maybe<Scalars['Int']>;
  chance?: Maybe<Scalars['Int']>;
  counting?: Maybe<Scalars['Boolean']>;
  noShow?: Maybe<Scalars['Boolean']>;
};

export type ZktPublicCompetitionDay = {
  __typename?: 'ZktPublicCompetitionDay';
  date?: Maybe<Scalars['String']>;
  label?: Maybe<Scalars['String']>;
  named?: Maybe<Scalars['Boolean']>;
  position?: Maybe<Scalars['Int']>;
};

export type ZktPublicCompetitionDetail = {
  __typename?: 'ZktPublicCompetitionDetail';
  championshipType?: Maybe<Scalars['String']>;
  competitors?: Maybe<Array<Maybe<ZktPublicRegisteredCompetitor>>>;
  contact?: Maybe<Scalars['String']>;
  country?: Maybe<Scalars['String']>;
  days?: Maybe<Array<ZktPublicCompetitionDay>>;
  delegates?: Maybe<Array<Maybe<ZktPublicNamed>>>;
  description?: Maybe<Scalars['String']>;
  endDate?: Maybe<Scalars['String']>;
  events?: Maybe<Array<Maybe<ZktPublicDetailEvent>>>;
  id?: Maybe<Scalars['String']>;
  latitude?: Maybe<Scalars['Float']>;
  location?: Maybe<Scalars['String']>;
  locationAddress?: Maybe<Scalars['String']>;
  longitude?: Maybe<Scalars['Float']>;
  mainEventId?: Maybe<Scalars['String']>;
  name?: Maybe<Scalars['String']>;
  organizers?: Maybe<Array<Maybe<ZktPublicNamed>>>;
  podiums?: Maybe<Array<Maybe<ZktPublicPodium>>>;
  registrationCount?: Maybe<Scalars['Int']>;
  rooms?: Maybe<Array<ZktPublicRoom>>;
  schedule?: Maybe<Array<Maybe<ZktPublicScheduleEntry>>>;
  slug?: Maybe<Scalars['String']>;
  startDate?: Maybe<Scalars['String']>;
  status?: Maybe<Scalars['String']>;
  tabs?: Maybe<Array<Maybe<ZktPublicTab>>>;
  timezone?: Maybe<Scalars['String']>;
};

export type ZktPublicCompetitionList = {
  __typename?: 'ZktPublicCompetitionList';
  hasMore?: Maybe<Scalars['Boolean']>;
  items?: Maybe<Array<Maybe<ZktPublicListItem>>>;
  page?: Maybe<Scalars['Int']>;
  pageSize?: Maybe<Scalars['Int']>;
  total?: Maybe<Scalars['Int']>;
};

export type ZktPublicCompetitor = {
  __typename?: 'ZktPublicCompetitor';
  avatarUrl?: Maybe<Scalars['String']>;
  country?: Maybe<Scalars['String']>;
  externalId?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  isGhost?: Maybe<Scalars['Boolean']>;
  name?: Maybe<Scalars['String']>;
  wcaId?: Maybe<Scalars['String']>;
};

export type ZktPublicCompetitorDetail = {
  __typename?: 'ZktPublicCompetitorDetail';
  assignments?: Maybe<Array<Maybe<ZktPublicScheduleItemRow>>>;
  competitor?: Maybe<ZktPublicCompetitor>;
  dayLabel?: Maybe<Scalars['String']>;
  days?: Maybe<Array<ZktPublicCompetitionDay>>;
  registeredEventIds?: Maybe<Array<Maybe<Scalars['String']>>>;
  results?: Maybe<Array<Maybe<ZktPublicCompetitorResult>>>;
};

export type ZktPublicCompetitorResult = {
  __typename?: 'ZktPublicCompetitorResult';
  attempts?: Maybe<Array<Maybe<Scalars['Int']>>>;
  average?: Maybe<Scalars['Int']>;
  best?: Maybe<Scalars['Int']>;
  eventId?: Maybe<Scalars['String']>;
  eventName?: Maybe<Scalars['String']>;
  format?: Maybe<Scalars['String']>;
  proceeds?: Maybe<Scalars['Boolean']>;
  ranking?: Maybe<Scalars['Int']>;
  recordTags?: Maybe<ZktPublicRecordTags>;
  roundId?: Maybe<Scalars['String']>;
  roundNumber?: Maybe<Scalars['Int']>;
};

export type ZktPublicDetailEvent = {
  __typename?: 'ZktPublicDetailEvent';
  eventId?: Maybe<Scalars['String']>;
  eventName?: Maybe<Scalars['String']>;
  rounds?: Maybe<Array<Maybe<ZktPublicDetailRound>>>;
};

export type ZktPublicDetailRound = {
  __typename?: 'ZktPublicDetailRound';
  advancementLevel?: Maybe<Scalars['Int']>;
  advancementType?: Maybe<Scalars['String']>;
  cutoffAttempts?: Maybe<Scalars['Int']>;
  cutoffCs?: Maybe<Scalars['Int']>;
  dayIndex?: Maybe<Scalars['Int']>;
  dayLabel?: Maybe<Scalars['String']>;
  dualChance?: Maybe<Scalars['Boolean']>;
  endTime?: Maybe<Scalars['String']>;
  format?: Maybe<Scalars['String']>;
  groups?: Maybe<Array<Maybe<ZktPublicRoundGroup>>>;
  isFinal?: Maybe<Scalars['Boolean']>;
  numEntered?: Maybe<Scalars['Int']>;
  roomId?: Maybe<Scalars['String']>;
  roundId?: Maybe<Scalars['String']>;
  roundNumber?: Maybe<Scalars['Int']>;
  startTime?: Maybe<Scalars['String']>;
  status?: Maybe<Scalars['String']>;
  timeLimitCs?: Maybe<Scalars['Int']>;
  totalExpected?: Maybe<Scalars['Int']>;
};

export type ZktPublicGroupAssignmentRow = {
  __typename?: 'ZktPublicGroupAssignmentRow';
  competitor?: Maybe<ZktPublicCompetitor>;
  role?: Maybe<Scalars['String']>;
  seedResult?: Maybe<Scalars['Int']>;
  stationNumber?: Maybe<Scalars['Int']>;
};

export type ZktPublicGroupAssignments = {
  __typename?: 'ZktPublicGroupAssignments';
  assignments?: Maybe<Array<Maybe<ZktPublicGroupAssignmentRow>>>;
  dayLabel?: Maybe<Scalars['String']>;
  endTime?: Maybe<Scalars['String']>;
  groupId?: Maybe<Scalars['String']>;
  groupNumber?: Maybe<Scalars['Int']>;
  round?: Maybe<ZktPublicMiniRound>;
  startTime?: Maybe<Scalars['String']>;
};

export type ZktPublicListItem = {
  __typename?: 'ZktPublicListItem';
  championshipType?: Maybe<Scalars['String']>;
  country?: Maybe<Scalars['String']>;
  endDate?: Maybe<Scalars['String']>;
  eventIds?: Maybe<Array<Maybe<Scalars['String']>>>;
  id?: Maybe<Scalars['String']>;
  location?: Maybe<Scalars['String']>;
  name?: Maybe<Scalars['String']>;
  registrationCount?: Maybe<Scalars['Int']>;
  shortName?: Maybe<Scalars['String']>;
  slug?: Maybe<Scalars['String']>;
  startDate?: Maybe<Scalars['String']>;
  status?: Maybe<Scalars['String']>;
};

export type ZktPublicMiniRound = {
  __typename?: 'ZktPublicMiniRound';
  dayLabel?: Maybe<Scalars['String']>;
  eventId?: Maybe<Scalars['String']>;
  eventName?: Maybe<Scalars['String']>;
  format?: Maybe<Scalars['String']>;
  isFinal?: Maybe<Scalars['Boolean']>;
  roundId?: Maybe<Scalars['String']>;
  roundNumber?: Maybe<Scalars['Int']>;
  status?: Maybe<Scalars['String']>;
};

export type ZktPublicMyListItem = {
  __typename?: 'ZktPublicMyListItem';
  championshipType?: Maybe<Scalars['String']>;
  country?: Maybe<Scalars['String']>;
  dayDate?: Maybe<Scalars['String']>;
  dayLabel?: Maybe<Scalars['String']>;
  endDate?: Maybe<Scalars['String']>;
  eventIds?: Maybe<Array<Maybe<Scalars['String']>>>;
  id?: Maybe<Scalars['String']>;
  location?: Maybe<Scalars['String']>;
  name?: Maybe<Scalars['String']>;
  registrationCount?: Maybe<Scalars['Int']>;
  registrationNumber?: Maybe<Scalars['Int']>;
  registrationStatus?: Maybe<Scalars['String']>;
  shortName?: Maybe<Scalars['String']>;
  slug?: Maybe<Scalars['String']>;
  startDate?: Maybe<Scalars['String']>;
  status?: Maybe<Scalars['String']>;
};

export type ZktPublicNamed = {
  __typename?: 'ZktPublicNamed';
  name?: Maybe<Scalars['String']>;
};

export type ZktPublicPodium = {
  __typename?: 'ZktPublicPodium';
  dayLabel?: Maybe<Scalars['String']>;
  entries?: Maybe<Array<Maybe<ZktPublicPodiumEntry>>>;
  eventId?: Maybe<Scalars['String']>;
  eventName?: Maybe<Scalars['String']>;
};

export type ZktPublicPodiumEntry = {
  __typename?: 'ZktPublicPodiumEntry';
  attempts: Array<Maybe<Scalars['Int']>>;
  average?: Maybe<Scalars['Int']>;
  best?: Maybe<Scalars['Int']>;
  competitor?: Maybe<ZktPublicCompetitor>;
  ranking?: Maybe<Scalars['Int']>;
  recordTags?: Maybe<ZktPublicRecordTags>;
};

export type ZktPublicRecordTags = {
  __typename?: 'ZktPublicRecordTags';
  average?: Maybe<Scalars['String']>;
  single?: Maybe<Scalars['String']>;
};

export type ZktPublicRegisteredCompetitor = {
  __typename?: 'ZktPublicRegisteredCompetitor';
  avatarUrl?: Maybe<Scalars['String']>;
  country?: Maybe<Scalars['String']>;
  dayIndex?: Maybe<Scalars['Int']>;
  dayLabel?: Maybe<Scalars['String']>;
  externalId?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  isGhost?: Maybe<Scalars['Boolean']>;
  name?: Maybe<Scalars['String']>;
  registeredEventIds?: Maybe<Array<Maybe<Scalars['String']>>>;
  registrationNumber?: Maybe<Scalars['Int']>;
  wcaId?: Maybe<Scalars['String']>;
};

export type ZktPublicRoom = {
  __typename?: 'ZktPublicRoom';
  color?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  name?: Maybe<Scalars['String']>;
};

export type ZktPublicRoundGroup = {
  __typename?: 'ZktPublicRoundGroup';
  dayIndex?: Maybe<Scalars['Int']>;
  dayLabel?: Maybe<Scalars['String']>;
  endTime?: Maybe<Scalars['String']>;
  groupId?: Maybe<Scalars['String']>;
  groupNumber?: Maybe<Scalars['Int']>;
  roomId?: Maybe<Scalars['String']>;
  startTime?: Maybe<Scalars['String']>;
};

export type ZktPublicRoundResults = {
  __typename?: 'ZktPublicRoundResults';
  advancementLevel?: Maybe<Scalars['Int']>;
  advancementType?: Maybe<Scalars['String']>;
  cutoffAttempts?: Maybe<Scalars['Int']>;
  cutoffCs?: Maybe<Scalars['Int']>;
  dualChance?: Maybe<Scalars['Boolean']>;
  eventId?: Maybe<Scalars['String']>;
  eventName?: Maybe<Scalars['String']>;
  format?: Maybe<Scalars['String']>;
  results?: Maybe<Array<Maybe<ZktPublicAttemptResult>>>;
  roundId?: Maybe<Scalars['String']>;
  roundNumber?: Maybe<Scalars['Int']>;
  status?: Maybe<Scalars['String']>;
  timeLimitCs?: Maybe<Scalars['Int']>;
};

export type ZktPublicScheduleEntry = {
  __typename?: 'ZktPublicScheduleEntry';
  endTime?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  roomId?: Maybe<Scalars['String']>;
  startTime?: Maybe<Scalars['String']>;
  title?: Maybe<Scalars['String']>;
};

export type ZktPublicScheduleItemRow = {
  __typename?: 'ZktPublicScheduleItemRow';
  chance?: Maybe<Scalars['Int']>;
  dayLabel?: Maybe<Scalars['String']>;
  endTime?: Maybe<Scalars['String']>;
  groupNumber?: Maybe<Scalars['Int']>;
  role?: Maybe<Scalars['String']>;
  round?: Maybe<ZktPublicMiniRound>;
  startTime?: Maybe<Scalars['String']>;
  stationNumber?: Maybe<Scalars['Int']>;
};

export type ZktPublicTab = {
  __typename?: 'ZktPublicTab';
  content?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  order?: Maybe<Scalars['Int']>;
  title?: Maybe<Scalars['String']>;
};

export type AdminProUsersQueryVariables = Exact<{
  pageArgs?: InputMaybe<PaginationArgsInput>;
  search?: InputMaybe<Scalars['String']>;
}>;


export type AdminProUsersQuery = { __typename?: 'Query', adminUserSearch?: { __typename?: 'PaginatedUserAccountsForAdmin', hasMore?: boolean | null, total?: number | null, items?: Array<{ __typename?: 'UserAccountForAdmin', id?: string | null, username?: string | null, email?: string | null, created_at?: any | null, is_pro?: boolean | null, pro_expires_at?: any | null, iap_platform?: string | null, iap_product_id?: string | null, iap_cancellation_at?: any | null, iap_billing_issue_at?: any | null, iap_paused_until?: any | null, revenuecat_user_id?: string | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', storage_path?: string | null } | null } | null } | null> | null } | null };

export type AlgSetItemFragmentFragment = { __typename?: 'AlgSetItem', id?: string | null, category?: string | null, case_name?: string | null, subset?: string | null, puzzle?: string | null, algorithm?: string | null, position?: number | null };

export type AlgSetOwnerFragmentFragment = { __typename?: 'AlgSetOwner', id?: string | null, username?: string | null, verified?: boolean | null, avatar_path?: string | null };

export type AlgSetSummaryFragmentFragment = { __typename?: 'AlgSetSummary', id?: string | null, code?: string | null, name?: string | null, description?: string | null, visibility?: string | null, item_count?: number | null, save_count?: number | null, categories?: Array<string | null> | null, puzzles?: Array<string | null> | null, published_at?: any | null, updated_at?: any | null, created_at?: any | null, hidden?: boolean | null, preview?: Array<{ __typename?: 'AlgSetItem', id?: string | null, category?: string | null, case_name?: string | null, subset?: string | null, puzzle?: string | null, algorithm?: string | null, position?: number | null } | null> | null, owner?: { __typename?: 'AlgSetOwner', id?: string | null, username?: string | null, verified?: boolean | null, avatar_path?: string | null } | null };

export type AlgSetHeadFragmentFragment = { __typename?: 'AlgSet', id?: string | null, code?: string | null, name?: string | null, description?: string | null, visibility?: string | null, item_count?: number | null, save_count?: number | null, categories?: Array<string | null> | null, puzzles?: Array<string | null> | null, published_at?: any | null, updated_at?: any | null, created_at?: any | null, hidden?: boolean | null, is_owner?: boolean | null, is_saved?: boolean | null, preview?: Array<{ __typename?: 'AlgSetItem', id?: string | null, category?: string | null, case_name?: string | null, subset?: string | null, puzzle?: string | null, algorithm?: string | null, position?: number | null } | null> | null, owner?: { __typename?: 'AlgSetOwner', id?: string | null, username?: string | null, verified?: boolean | null, avatar_path?: string | null } | null };

export type AlgSetFragmentFragment = { __typename?: 'AlgSet', id?: string | null, code?: string | null, name?: string | null, description?: string | null, visibility?: string | null, item_count?: number | null, save_count?: number | null, categories?: Array<string | null> | null, puzzles?: Array<string | null> | null, published_at?: any | null, updated_at?: any | null, created_at?: any | null, hidden?: boolean | null, is_owner?: boolean | null, is_saved?: boolean | null, items?: Array<{ __typename?: 'AlgSetItem', id?: string | null, category?: string | null, case_name?: string | null, subset?: string | null, puzzle?: string | null, algorithm?: string | null, position?: number | null } | null> | null, preview?: Array<{ __typename?: 'AlgSetItem', id?: string | null, category?: string | null, case_name?: string | null, subset?: string | null, puzzle?: string | null, algorithm?: string | null, position?: number | null } | null> | null, owner?: { __typename?: 'AlgSetOwner', id?: string | null, username?: string | null, verified?: boolean | null, avatar_path?: string | null } | null };

export type MyAlgSetsQueryVariables = Exact<{ [key: string]: never; }>;


export type MyAlgSetsQuery = { __typename?: 'Query', myAlgSets?: { __typename?: 'MyAlgSets', own?: Array<{ __typename?: 'AlgSetSummary', id?: string | null, code?: string | null, name?: string | null, description?: string | null, visibility?: string | null, item_count?: number | null, save_count?: number | null, categories?: Array<string | null> | null, puzzles?: Array<string | null> | null, published_at?: any | null, updated_at?: any | null, created_at?: any | null, hidden?: boolean | null, preview?: Array<{ __typename?: 'AlgSetItem', id?: string | null, category?: string | null, case_name?: string | null, subset?: string | null, puzzle?: string | null, algorithm?: string | null, position?: number | null } | null> | null, owner?: { __typename?: 'AlgSetOwner', id?: string | null, username?: string | null, verified?: boolean | null, avatar_path?: string | null } | null } | null> | null, saved?: Array<{ __typename?: 'SavedAlgSet', set_id?: string | null, saved_at?: any | null, unavailable?: boolean | null, set?: { __typename?: 'AlgSetSummary', id?: string | null, code?: string | null, name?: string | null, description?: string | null, visibility?: string | null, item_count?: number | null, save_count?: number | null, categories?: Array<string | null> | null, puzzles?: Array<string | null> | null, published_at?: any | null, updated_at?: any | null, created_at?: any | null, hidden?: boolean | null, preview?: Array<{ __typename?: 'AlgSetItem', id?: string | null, category?: string | null, case_name?: string | null, subset?: string | null, puzzle?: string | null, algorithm?: string | null, position?: number | null } | null> | null, owner?: { __typename?: 'AlgSetOwner', id?: string | null, username?: string | null, verified?: boolean | null, avatar_path?: string | null } | null } | null } | null> | null } | null };

export type AlgSetQueryVariables = Exact<{
  code: Scalars['String'];
}>;


export type AlgSetQuery = { __typename?: 'Query', algSet?: { __typename?: 'AlgSet', id?: string | null, code?: string | null, name?: string | null, description?: string | null, visibility?: string | null, item_count?: number | null, save_count?: number | null, categories?: Array<string | null> | null, puzzles?: Array<string | null> | null, published_at?: any | null, updated_at?: any | null, created_at?: any | null, hidden?: boolean | null, is_owner?: boolean | null, is_saved?: boolean | null, items?: Array<{ __typename?: 'AlgSetItem', id?: string | null, category?: string | null, case_name?: string | null, subset?: string | null, puzzle?: string | null, algorithm?: string | null, position?: number | null } | null> | null, preview?: Array<{ __typename?: 'AlgSetItem', id?: string | null, category?: string | null, case_name?: string | null, subset?: string | null, puzzle?: string | null, algorithm?: string | null, position?: number | null } | null> | null, owner?: { __typename?: 'AlgSetOwner', id?: string | null, username?: string | null, verified?: boolean | null, avatar_path?: string | null } | null } | null };

export type AlgSetMetaQueryVariables = Exact<{
  code: Scalars['String'];
}>;


export type AlgSetMetaQuery = { __typename?: 'Query', algSet?: { __typename?: 'AlgSet', id?: string | null, code?: string | null, name?: string | null, description?: string | null, visibility?: string | null, item_count?: number | null, save_count?: number | null, categories?: Array<string | null> | null, puzzles?: Array<string | null> | null, published_at?: any | null, updated_at?: any | null, created_at?: any | null, hidden?: boolean | null, is_owner?: boolean | null, is_saved?: boolean | null, preview?: Array<{ __typename?: 'AlgSetItem', id?: string | null, category?: string | null, case_name?: string | null, subset?: string | null, puzzle?: string | null, algorithm?: string | null, position?: number | null } | null> | null, owner?: { __typename?: 'AlgSetOwner', id?: string | null, username?: string | null, verified?: boolean | null, avatar_path?: string | null } | null } | null };

export type CommunityAlgSetsQueryVariables = Exact<{
  q?: InputMaybe<Scalars['String']>;
  sort?: InputMaybe<Scalars['String']>;
  puzzle?: InputMaybe<Scalars['String']>;
  category?: InputMaybe<Scalars['String']>;
  page?: InputMaybe<Scalars['Int']>;
  page_size?: InputMaybe<Scalars['Int']>;
}>;


export type CommunityAlgSetsQuery = { __typename?: 'Query', communityAlgSets?: { __typename?: 'CommunityAlgSetPage', total?: number | null, has_more?: boolean | null, items?: Array<{ __typename?: 'AlgSetSummary', id?: string | null, code?: string | null, name?: string | null, description?: string | null, visibility?: string | null, item_count?: number | null, save_count?: number | null, categories?: Array<string | null> | null, puzzles?: Array<string | null> | null, published_at?: any | null, updated_at?: any | null, created_at?: any | null, hidden?: boolean | null, preview?: Array<{ __typename?: 'AlgSetItem', id?: string | null, category?: string | null, case_name?: string | null, subset?: string | null, puzzle?: string | null, algorithm?: string | null, position?: number | null } | null> | null, owner?: { __typename?: 'AlgSetOwner', id?: string | null, username?: string | null, verified?: boolean | null, avatar_path?: string | null } | null } | null> | null } | null };

export type CreateAlgSetMutationVariables = Exact<{
  input: AlgSetCreateInput;
}>;


export type CreateAlgSetMutation = { __typename?: 'Mutation', createAlgSet?: { __typename?: 'AlgSet', id?: string | null, code?: string | null, name?: string | null, description?: string | null, visibility?: string | null, item_count?: number | null, save_count?: number | null, categories?: Array<string | null> | null, puzzles?: Array<string | null> | null, published_at?: any | null, updated_at?: any | null, created_at?: any | null, hidden?: boolean | null, is_owner?: boolean | null, is_saved?: boolean | null, items?: Array<{ __typename?: 'AlgSetItem', id?: string | null, category?: string | null, case_name?: string | null, subset?: string | null, puzzle?: string | null, algorithm?: string | null, position?: number | null } | null> | null, preview?: Array<{ __typename?: 'AlgSetItem', id?: string | null, category?: string | null, case_name?: string | null, subset?: string | null, puzzle?: string | null, algorithm?: string | null, position?: number | null } | null> | null, owner?: { __typename?: 'AlgSetOwner', id?: string | null, username?: string | null, verified?: boolean | null, avatar_path?: string | null } | null } | null };

export type UpdateAlgSetMutationVariables = Exact<{
  id: Scalars['String'];
  input: AlgSetUpdateInput;
}>;


export type UpdateAlgSetMutation = { __typename?: 'Mutation', updateAlgSet?: { __typename?: 'AlgSet', id?: string | null, code?: string | null, name?: string | null, description?: string | null, visibility?: string | null, item_count?: number | null, save_count?: number | null, categories?: Array<string | null> | null, puzzles?: Array<string | null> | null, published_at?: any | null, updated_at?: any | null, created_at?: any | null, hidden?: boolean | null, is_owner?: boolean | null, is_saved?: boolean | null, preview?: Array<{ __typename?: 'AlgSetItem', id?: string | null, category?: string | null, case_name?: string | null, subset?: string | null, puzzle?: string | null, algorithm?: string | null, position?: number | null } | null> | null, owner?: { __typename?: 'AlgSetOwner', id?: string | null, username?: string | null, verified?: boolean | null, avatar_path?: string | null } | null } | null };

export type DeleteAlgSetMutationVariables = Exact<{
  id: Scalars['String'];
}>;


export type DeleteAlgSetMutation = { __typename?: 'Mutation', deleteAlgSet?: boolean | null };

export type ResetAlgSetCodeMutationVariables = Exact<{
  id: Scalars['String'];
}>;


export type ResetAlgSetCodeMutation = { __typename?: 'Mutation', resetAlgSetCode?: { __typename?: 'AlgSet', id?: string | null, code?: string | null, name?: string | null, description?: string | null, visibility?: string | null, item_count?: number | null, save_count?: number | null, categories?: Array<string | null> | null, puzzles?: Array<string | null> | null, published_at?: any | null, updated_at?: any | null, created_at?: any | null, hidden?: boolean | null, is_owner?: boolean | null, is_saved?: boolean | null, preview?: Array<{ __typename?: 'AlgSetItem', id?: string | null, category?: string | null, case_name?: string | null, subset?: string | null, puzzle?: string | null, algorithm?: string | null, position?: number | null } | null> | null, owner?: { __typename?: 'AlgSetOwner', id?: string | null, username?: string | null, verified?: boolean | null, avatar_path?: string | null } | null } | null };

export type AddAlgSetItemsMutationVariables = Exact<{
  set_id: Scalars['String'];
  items: Array<AlgSetItemInput> | AlgSetItemInput;
}>;


export type AddAlgSetItemsMutation = { __typename?: 'Mutation', addAlgSetItems?: { __typename?: 'AlgSet', id?: string | null, code?: string | null, name?: string | null, description?: string | null, visibility?: string | null, item_count?: number | null, save_count?: number | null, categories?: Array<string | null> | null, puzzles?: Array<string | null> | null, published_at?: any | null, updated_at?: any | null, created_at?: any | null, hidden?: boolean | null, is_owner?: boolean | null, is_saved?: boolean | null, items?: Array<{ __typename?: 'AlgSetItem', id?: string | null, category?: string | null, case_name?: string | null, subset?: string | null, puzzle?: string | null, algorithm?: string | null, position?: number | null } | null> | null, preview?: Array<{ __typename?: 'AlgSetItem', id?: string | null, category?: string | null, case_name?: string | null, subset?: string | null, puzzle?: string | null, algorithm?: string | null, position?: number | null } | null> | null, owner?: { __typename?: 'AlgSetOwner', id?: string | null, username?: string | null, verified?: boolean | null, avatar_path?: string | null } | null } | null };

export type UpdateAlgSetItemMutationVariables = Exact<{
  item_id: Scalars['String'];
  algorithm: Scalars['String'];
}>;


export type UpdateAlgSetItemMutation = { __typename?: 'Mutation', updateAlgSetItem?: { __typename?: 'AlgSetItem', id?: string | null, category?: string | null, case_name?: string | null, subset?: string | null, puzzle?: string | null, algorithm?: string | null, position?: number | null } | null };

export type RemoveAlgSetItemsMutationVariables = Exact<{
  set_id: Scalars['String'];
  item_ids: Array<Scalars['String']> | Scalars['String'];
}>;


export type RemoveAlgSetItemsMutation = { __typename?: 'Mutation', removeAlgSetItems?: { __typename?: 'AlgSet', id?: string | null, code?: string | null, name?: string | null, description?: string | null, visibility?: string | null, item_count?: number | null, save_count?: number | null, categories?: Array<string | null> | null, puzzles?: Array<string | null> | null, published_at?: any | null, updated_at?: any | null, created_at?: any | null, hidden?: boolean | null, is_owner?: boolean | null, is_saved?: boolean | null, items?: Array<{ __typename?: 'AlgSetItem', id?: string | null, category?: string | null, case_name?: string | null, subset?: string | null, puzzle?: string | null, algorithm?: string | null, position?: number | null } | null> | null, preview?: Array<{ __typename?: 'AlgSetItem', id?: string | null, category?: string | null, case_name?: string | null, subset?: string | null, puzzle?: string | null, algorithm?: string | null, position?: number | null } | null> | null, owner?: { __typename?: 'AlgSetOwner', id?: string | null, username?: string | null, verified?: boolean | null, avatar_path?: string | null } | null } | null };

export type ReorderAlgSetItemsMutationVariables = Exact<{
  set_id: Scalars['String'];
  item_ids: Array<Scalars['String']> | Scalars['String'];
}>;


export type ReorderAlgSetItemsMutation = { __typename?: 'Mutation', reorderAlgSetItems?: { __typename?: 'AlgSet', id?: string | null, code?: string | null, name?: string | null, description?: string | null, visibility?: string | null, item_count?: number | null, save_count?: number | null, categories?: Array<string | null> | null, puzzles?: Array<string | null> | null, published_at?: any | null, updated_at?: any | null, created_at?: any | null, hidden?: boolean | null, is_owner?: boolean | null, is_saved?: boolean | null, items?: Array<{ __typename?: 'AlgSetItem', id?: string | null, category?: string | null, case_name?: string | null, subset?: string | null, puzzle?: string | null, algorithm?: string | null, position?: number | null } | null> | null, preview?: Array<{ __typename?: 'AlgSetItem', id?: string | null, category?: string | null, case_name?: string | null, subset?: string | null, puzzle?: string | null, algorithm?: string | null, position?: number | null } | null> | null, owner?: { __typename?: 'AlgSetOwner', id?: string | null, username?: string | null, verified?: boolean | null, avatar_path?: string | null } | null } | null };

export type SaveAlgSetMutationVariables = Exact<{
  set_id: Scalars['String'];
}>;


export type SaveAlgSetMutation = { __typename?: 'Mutation', saveAlgSet?: boolean | null };

export type UnsaveAlgSetMutationVariables = Exact<{
  set_id: Scalars['String'];
}>;


export type UnsaveAlgSetMutation = { __typename?: 'Mutation', unsaveAlgSet?: boolean | null };

export type ReportAlgSetMutationVariables = Exact<{
  set_id: Scalars['String'];
  reason: Scalars['String'];
  note?: InputMaybe<Scalars['String']>;
}>;


export type ReportAlgSetMutation = { __typename?: 'Mutation', reportAlgSet?: boolean | null };

export type AdminSetAlgSetHiddenMutationVariables = Exact<{
  set_id: Scalars['String'];
  hidden: Scalars['Boolean'];
  reason?: InputMaybe<Scalars['String']>;
}>;


export type AdminSetAlgSetHiddenMutation = { __typename?: 'Mutation', adminSetAlgSetHidden?: { __typename?: 'AlgSet', id?: string | null, code?: string | null, name?: string | null, description?: string | null, visibility?: string | null, item_count?: number | null, save_count?: number | null, categories?: Array<string | null> | null, puzzles?: Array<string | null> | null, published_at?: any | null, updated_at?: any | null, created_at?: any | null, hidden?: boolean | null, is_owner?: boolean | null, is_saved?: boolean | null, preview?: Array<{ __typename?: 'AlgSetItem', id?: string | null, category?: string | null, case_name?: string | null, subset?: string | null, puzzle?: string | null, algorithm?: string | null, position?: number | null } | null> | null, owner?: { __typename?: 'AlgSetOwner', id?: string | null, username?: string | null, verified?: boolean | null, avatar_path?: string | null } | null } | null };

export type BattlePlayerFragmentFragment = { __typename?: 'BattlePlayer', id?: string | null, username?: string | null, pfp_image_url?: string | null };

export type BattleLeaderboardRowFragmentFragment = { __typename?: 'BattleLeaderboardRow', rank?: number | null, user_id?: string | null, username?: string | null, pfp_image_url?: string | null, rating?: number | null, provisional?: boolean | null, games?: number | null, wins?: number | null, losses?: number | null, draws?: number | null };

export type BattleLeaderboardQueryVariables = Exact<{
  puzzle?: InputMaybe<Scalars['String']>;
  page?: InputMaybe<Scalars['Int']>;
  search?: InputMaybe<Scalars['String']>;
}>;


export type BattleLeaderboardQuery = { __typename?: 'Query', battleLeaderboard?: { __typename?: 'BattleLeaderboardPage', total_count?: number | null, page?: number | null, page_size?: number | null, rows?: Array<{ __typename?: 'BattleLeaderboardRow', rank?: number | null, user_id?: string | null, username?: string | null, pfp_image_url?: string | null, rating?: number | null, provisional?: boolean | null, games?: number | null, wins?: number | null, losses?: number | null, draws?: number | null } | null> | null } | null };

export type MyBattleRatingQueryVariables = Exact<{
  puzzle?: InputMaybe<Scalars['String']>;
}>;


export type MyBattleRatingQuery = { __typename?: 'Query', myBattleRating?: { __typename?: 'MyBattleRating', puzzle?: string | null, rating?: number | null, provisional?: boolean | null, games?: number | null, wins?: number | null, losses?: number | null, draws?: number | null, peak_rating?: number | null, rank?: number | null } | null };

export type UserBattleRatingQueryVariables = Exact<{
  userId: Scalars['String'];
  puzzle?: InputMaybe<Scalars['String']>;
}>;


export type UserBattleRatingQuery = { __typename?: 'Query', userBattleRating?: { __typename?: 'MyBattleRating', puzzle?: string | null, rating?: number | null, provisional?: boolean | null, games?: number | null, wins?: number | null, losses?: number | null, draws?: number | null, peak_rating?: number | null, rank?: number | null } | null };

export type BattleMatchHistoryQueryVariables = Exact<{
  userId: Scalars['String'];
  page?: InputMaybe<Scalars['Int']>;
}>;


export type BattleMatchHistoryQuery = { __typename?: 'Query', battleMatchHistory?: { __typename?: 'BattleMatchHistoryPage', total?: number | null, hasMore?: boolean | null, items?: Array<{ __typename?: 'BattleMatchSummary', id?: string | null, puzzle?: string | null, ended_at?: any | null, result?: string | null, score_for?: number | null, score_against?: number | null, rated?: boolean | null, is_rematch?: boolean | null, is_challenge?: boolean | null, end_reason?: string | null, rating_before?: number | null, rating_after?: number | null, delta?: number | null, opponent?: { __typename?: 'BattlePlayer', id?: string | null, username?: string | null, pfp_image_url?: string | null } | null } | null> | null } | null };

export type BattleMatchQueryVariables = Exact<{
  id: Scalars['String'];
}>;


export type BattleMatchQuery = { __typename?: 'Query', battleMatch?: { __typename?: 'BattleMatchDetail', id?: string | null, puzzle?: string | null, status?: string | null, end_reason?: string | null, rated?: boolean | null, is_rematch?: boolean | null, is_challenge?: boolean | null, winner?: string | null, rounds_a?: number | null, rounds_b?: number | null, rating_a_before?: number | null, rating_a_after?: number | null, rating_b_before?: number | null, rating_b_after?: number | null, started_at?: any | null, ended_at?: any | null, voided_at?: any | null, flags?: Array<string | null> | null, viewer_side?: string | null, player_a?: { __typename?: 'BattlePlayer', id?: string | null, username?: string | null, pfp_image_url?: string | null } | null, player_b?: { __typename?: 'BattlePlayer', id?: string | null, username?: string | null, pfp_image_url?: string | null } | null, rounds?: Array<{ __typename?: 'BattleRoundDetail', index?: number | null, scramble?: string | null, winner?: string | null, a_time_ms?: number | null, a_penalty?: string | null, b_time_ms?: number | null, b_penalty?: string | null, a_flags?: Array<string | null> | null, b_flags?: Array<string | null> | null, a_moves?: string | null, b_moves?: string | null, a_dnf_reason?: string | null, b_dnf_reason?: string | null } | null> | null } | null };

export type AdminFlaggedBattleMatchesQueryVariables = Exact<{
  page?: InputMaybe<Scalars['Int']>;
}>;


export type AdminFlaggedBattleMatchesQuery = { __typename?: 'Query', adminFlaggedBattleMatches?: { __typename?: 'AdminBattleMatchPage', total?: number | null, hasMore?: boolean | null, items?: Array<{ __typename?: 'AdminBattleMatchRow', id?: string | null, puzzle?: string | null, status?: string | null, end_reason?: string | null, rated?: boolean | null, is_challenge?: boolean | null, winner?: string | null, rounds_a?: number | null, rounds_b?: number | null, ended_at?: any | null, voided_at?: any | null, flags?: Array<string | null> | null, player_a?: { __typename?: 'BattlePlayer', id?: string | null, username?: string | null, pfp_image_url?: string | null } | null, player_b?: { __typename?: 'BattlePlayer', id?: string | null, username?: string | null, pfp_image_url?: string | null } | null } | null> | null } | null };

export type BattleChallengeQueryVariables = Exact<{
  code: Scalars['String'];
}>;


export type BattleChallengeQuery = { __typename?: 'Query', battleChallenge?: { __typename?: 'BattleChallengeInfo', code?: string | null, status?: string | null, expires_at?: any | null, restricted?: boolean | null, own?: boolean | null, for_you?: boolean | null, from?: { __typename?: 'BattlePlayer', id?: string | null, username?: string | null, pfp_image_url?: string | null } | null } | null };

export type BattleHeadToHeadQueryVariables = Exact<{
  userId: Scalars['String'];
}>;


export type BattleHeadToHeadQuery = { __typename?: 'Query', battleHeadToHead?: { __typename?: 'BattleHeadToHead', wins?: number | null, losses?: number | null, draws?: number | null } | null };

export type AdminVoidBattleMatchMutationVariables = Exact<{
  id: Scalars['String'];
}>;


export type AdminVoidBattleMatchMutation = { __typename?: 'Mutation', adminVoidBattleMatch?: { __typename?: 'VoidBattleMatchResult', match_id?: string | null, changed?: boolean | null, reverted_a?: boolean | null, reverted_b?: boolean | null } | null };

export type CubeCalibrationFragmentFragment = { __typename?: 'CubeCalibration', id?: string | null, cube_id?: string | null, platform?: string | null, device_model?: string | null, os_version?: string | null, app_version?: string | null, sensor_name?: string | null, peak_ut?: number | null, rest_ut?: number | null, noise_ut?: number | null, near_min_ut?: number | null, far_max_ut?: number | null, quality?: string | null, sample_count?: number | null, sweep_ms?: number | null, rate_hz?: number | null, algo_version?: number | null, measured_at?: any | null, created_at?: any | null, updated_at?: any | null };

export type CubeFragmentFragment = { __typename?: 'Cube', id?: string | null, puzzle?: string | null, name?: string | null, brand?: string | null, is_smart?: boolean | null, ble_device_id?: string | null, ble_name?: string | null, legacy_smart_device_ids?: Array<string | null> | null, archived_at?: any | null, created_at?: any | null, updated_at?: any | null, solve_count?: number | null, first_used_at?: any | null, last_used_at?: any | null, calibrations?: Array<{ __typename?: 'CubeCalibration', id?: string | null, cube_id?: string | null, platform?: string | null, device_model?: string | null, os_version?: string | null, app_version?: string | null, sensor_name?: string | null, peak_ut?: number | null, rest_ut?: number | null, noise_ut?: number | null, near_min_ut?: number | null, far_max_ut?: number | null, quality?: string | null, sample_count?: number | null, sweep_ms?: number | null, rate_hz?: number | null, algo_version?: number | null, measured_at?: any | null, created_at?: any | null, updated_at?: any | null } | null> | null };

export type CubeMainFragmentFragment = { __typename?: 'CubeMain', puzzle?: string | null, cube_id?: string | null, set_at?: any | null };

export type MyCubeStateQueryVariables = Exact<{ [key: string]: never; }>;


export type MyCubeStateQuery = { __typename?: 'Query', myCubeState?: { __typename?: 'MyCubeState', cubes?: Array<{ __typename?: 'Cube', id?: string | null, puzzle?: string | null, name?: string | null, brand?: string | null, is_smart?: boolean | null, ble_device_id?: string | null, ble_name?: string | null, legacy_smart_device_ids?: Array<string | null> | null, archived_at?: any | null, created_at?: any | null, updated_at?: any | null, solve_count?: number | null, first_used_at?: any | null, last_used_at?: any | null, calibrations?: Array<{ __typename?: 'CubeCalibration', id?: string | null, cube_id?: string | null, platform?: string | null, device_model?: string | null, os_version?: string | null, app_version?: string | null, sensor_name?: string | null, peak_ut?: number | null, rest_ut?: number | null, noise_ut?: number | null, near_min_ut?: number | null, far_max_ut?: number | null, quality?: string | null, sample_count?: number | null, sweep_ms?: number | null, rate_hz?: number | null, algo_version?: number | null, measured_at?: any | null, created_at?: any | null, updated_at?: any | null } | null> | null } | null> | null, mains?: Array<{ __typename?: 'CubeMain', puzzle?: string | null, cube_id?: string | null, set_at?: any | null } | null> | null } | null };

export type CreateCubeMutationVariables = Exact<{
  input: CubeInput;
}>;


export type CreateCubeMutation = { __typename?: 'Mutation', createCube?: { __typename?: 'Cube', id?: string | null, puzzle?: string | null, name?: string | null, brand?: string | null, is_smart?: boolean | null, ble_device_id?: string | null, ble_name?: string | null, legacy_smart_device_ids?: Array<string | null> | null, archived_at?: any | null, created_at?: any | null, updated_at?: any | null, solve_count?: number | null, first_used_at?: any | null, last_used_at?: any | null, calibrations?: Array<{ __typename?: 'CubeCalibration', id?: string | null, cube_id?: string | null, platform?: string | null, device_model?: string | null, os_version?: string | null, app_version?: string | null, sensor_name?: string | null, peak_ut?: number | null, rest_ut?: number | null, noise_ut?: number | null, near_min_ut?: number | null, far_max_ut?: number | null, quality?: string | null, sample_count?: number | null, sweep_ms?: number | null, rate_hz?: number | null, algo_version?: number | null, measured_at?: any | null, created_at?: any | null, updated_at?: any | null } | null> | null } | null };

export type UpdateCubeMutationVariables = Exact<{
  id: Scalars['String'];
  input: CubeUpdateInput;
}>;


export type UpdateCubeMutation = { __typename?: 'Mutation', updateCube?: { __typename?: 'Cube', id?: string | null, puzzle?: string | null, name?: string | null, brand?: string | null, is_smart?: boolean | null, ble_device_id?: string | null, ble_name?: string | null, legacy_smart_device_ids?: Array<string | null> | null, archived_at?: any | null, created_at?: any | null, updated_at?: any | null, solve_count?: number | null, first_used_at?: any | null, last_used_at?: any | null, calibrations?: Array<{ __typename?: 'CubeCalibration', id?: string | null, cube_id?: string | null, platform?: string | null, device_model?: string | null, os_version?: string | null, app_version?: string | null, sensor_name?: string | null, peak_ut?: number | null, rest_ut?: number | null, noise_ut?: number | null, near_min_ut?: number | null, far_max_ut?: number | null, quality?: string | null, sample_count?: number | null, sweep_ms?: number | null, rate_hz?: number | null, algo_version?: number | null, measured_at?: any | null, created_at?: any | null, updated_at?: any | null } | null> | null } | null };

export type SetCubeArchivedMutationVariables = Exact<{
  id: Scalars['String'];
  archived: Scalars['Boolean'];
}>;


export type SetCubeArchivedMutation = { __typename?: 'Mutation', setCubeArchived?: { __typename?: 'Cube', id?: string | null, puzzle?: string | null, name?: string | null, brand?: string | null, is_smart?: boolean | null, ble_device_id?: string | null, ble_name?: string | null, legacy_smart_device_ids?: Array<string | null> | null, archived_at?: any | null, created_at?: any | null, updated_at?: any | null, solve_count?: number | null, first_used_at?: any | null, last_used_at?: any | null, calibrations?: Array<{ __typename?: 'CubeCalibration', id?: string | null, cube_id?: string | null, platform?: string | null, device_model?: string | null, os_version?: string | null, app_version?: string | null, sensor_name?: string | null, peak_ut?: number | null, rest_ut?: number | null, noise_ut?: number | null, near_min_ut?: number | null, far_max_ut?: number | null, quality?: string | null, sample_count?: number | null, sweep_ms?: number | null, rate_hz?: number | null, algo_version?: number | null, measured_at?: any | null, created_at?: any | null, updated_at?: any | null } | null> | null } | null };

export type DeleteCubeMutationVariables = Exact<{
  id: Scalars['String'];
}>;


export type DeleteCubeMutation = { __typename?: 'Mutation', deleteCube?: boolean | null };

export type SetMainCubeMutationVariables = Exact<{
  puzzle: Scalars['String'];
  cube_id?: InputMaybe<Scalars['String']>;
  set_at: Scalars['DateTime'];
}>;


export type SetMainCubeMutation = { __typename?: 'Mutation', setMainCube?: { __typename?: 'CubeMain', puzzle?: string | null, cube_id?: string | null, set_at?: any | null } | null };

export type EnsureSmartCubeMutationVariables = Exact<{
  ble_device_id: Scalars['String'];
  ble_name?: InputMaybe<Scalars['String']>;
}>;


export type EnsureSmartCubeMutation = { __typename?: 'Mutation', ensureSmartCube?: { __typename?: 'Cube', id?: string | null, puzzle?: string | null, name?: string | null, brand?: string | null, is_smart?: boolean | null, ble_device_id?: string | null, ble_name?: string | null, legacy_smart_device_ids?: Array<string | null> | null, archived_at?: any | null, created_at?: any | null, updated_at?: any | null, solve_count?: number | null, first_used_at?: any | null, last_used_at?: any | null, calibrations?: Array<{ __typename?: 'CubeCalibration', id?: string | null, cube_id?: string | null, platform?: string | null, device_model?: string | null, os_version?: string | null, app_version?: string | null, sensor_name?: string | null, peak_ut?: number | null, rest_ut?: number | null, noise_ut?: number | null, near_min_ut?: number | null, far_max_ut?: number | null, quality?: string | null, sample_count?: number | null, sweep_ms?: number | null, rate_hz?: number | null, algo_version?: number | null, measured_at?: any | null, created_at?: any | null, updated_at?: any | null } | null> | null } | null };

export type SaveCubeCalibrationMutationVariables = Exact<{
  input: CubeCalibrationInput;
}>;


export type SaveCubeCalibrationMutation = { __typename?: 'Mutation', saveCubeCalibration?: { __typename?: 'CubeCalibration', id?: string | null, cube_id?: string | null, platform?: string | null, device_model?: string | null, os_version?: string | null, app_version?: string | null, sensor_name?: string | null, peak_ut?: number | null, rest_ut?: number | null, noise_ut?: number | null, near_min_ut?: number | null, far_max_ut?: number | null, quality?: string | null, sample_count?: number | null, sweep_ms?: number | null, rate_hz?: number | null, algo_version?: number | null, measured_at?: any | null, created_at?: any | null, updated_at?: any | null } | null };

export type DeleteCubeCalibrationMutationVariables = Exact<{
  id: Scalars['String'];
}>;


export type DeleteCubeCalibrationMutation = { __typename?: 'Mutation', deleteCubeCalibration?: boolean | null };

export type AdminCubeCalibrationsQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  username?: InputMaybe<Scalars['String']>;
  puzzle?: InputMaybe<Scalars['String']>;
  platform?: InputMaybe<Scalars['String']>;
  deviceModel?: InputMaybe<Scalars['String']>;
}>;


export type AdminCubeCalibrationsQuery = { __typename?: 'Query', adminCubeCalibrations?: Array<{ __typename?: 'AdminCubeCalibrationRow', id?: string | null, user_id?: string | null, username?: string | null, email?: string | null, cube_id?: string | null, cube_name?: string | null, cube_brand?: string | null, puzzle?: string | null, puzzle_name?: string | null, platform?: string | null, device_model?: string | null, os_version?: string | null, app_version?: string | null, sensor_name?: string | null, peak_ut?: number | null, rest_ut?: number | null, noise_ut?: number | null, near_min_ut?: number | null, far_max_ut?: number | null, quality?: string | null, current_near_min_ut?: number | null, current_far_max_ut?: number | null, current_quality?: string | null, noisy?: boolean | null, sample_count?: number | null, sweep_ms?: number | null, rate_hz?: number | null, algo_version?: number | null, measured_at?: any | null, created_at?: any | null, updated_at?: any | null } | null> | null };

export type AdminCubeCalibrationSummaryQueryVariables = Exact<{
  days?: InputMaybe<Scalars['Int']>;
}>;


export type AdminCubeCalibrationSummaryQuery = { __typename?: 'Query', adminCubeCalibrationSummary?: Array<{ __typename?: 'AdminCubeCalibrationSummary', puzzle?: string | null, platform?: string | null, device_model?: string | null, calibrations?: number | null, distinct_users?: number | null, median_rest_ut?: number | null, p10_rest_ut?: number | null, median_peak_ut?: number | null, median_noise_ut?: number | null, weak_ratio?: number | null, telemetry_placements?: number | null, telemetry_median_near_ut?: number | null, telemetry_lifts?: number | null, telemetry_rejects?: number | null } | null> | null };

export type MiniSolveFragmentFragment = { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, scramble_subset?: string | null, session_id?: string | null, trainer_name?: string | null, bulk?: boolean | null, scramble?: string | null, from_timer?: boolean | null, training_session_id?: string | null, dnf?: boolean | null, plus_two?: boolean | null, is_smart_cube?: boolean | null, is_virtual_cube?: boolean | null, cube_id?: string | null, created_at?: any | null, started_at?: any | null, ended_at?: any | null };

export type StatsFragmentFragment = { __typename?: 'Stats', profile_views?: number | null, solve_views?: number | null };

export type StatsModuleBlockFragmentFragment = { __typename?: 'StatsModuleBlock', statType?: string | null, sortBy?: string | null, session?: boolean | null, colorName?: string | null, averageCount?: number | null };

export type AlgorithmOverrideFragmentFragment = { __typename?: 'AlgorithmOverride', cube_key?: string | null, rotate?: number | null, solution?: string | null };

export type TrainerFavoriteFragmentFragment = { __typename?: 'TrainerFavorite', cube_key?: string | null };

export type TrainerAlgorithmFragmentFragment = { __typename?: 'TrainerAlgorithm', id?: string | null, name?: string | null, scrambles?: string | null, solution?: string | null, pro_only?: boolean | null, cube_type?: string | null, algo_type?: string | null, colors?: string | null, group_name?: string | null };

export type SessionFragmentFragment = { __typename?: 'Session', id?: string | null, name?: string | null, created_at?: any | null, order?: number | null };

export type SolveFragmentFragment = { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, scramble_subset?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, is_virtual_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_rotations?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, phase_splits?: string | null, cube_id?: string | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, case_key?: string | null, case_set?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null };

export type CustomCubeTypeFragmentFragment = { __typename?: 'CustomCubeType', id?: string | null, user_id?: string | null, name?: string | null, created_at?: any | null, scramble?: string | null, private?: boolean | null };

export type SettingsFragmentFragment = { __typename?: 'Setting', id?: string | null, user_id?: string | null, focus_mode?: boolean | null, freeze_time?: number | null, inspection?: boolean | null, manual_entry?: boolean | null, inspection_delay?: number | null, session_id?: string | null, inverse_time_list?: boolean | null, hide_time_when_solving?: boolean | null, nav_collapsed?: boolean | null, timer_decimal_points?: number | null, pb_confetti?: boolean | null, play_inspection_sound?: boolean | null, zero_out_time_after_solve?: boolean | null, confirm_delete_solve?: boolean | null, use_space_with_smart_cube?: boolean | null, use_2d_scramble_visual?: boolean | null, require_period_in_manual_time_entry?: boolean | null, cube_type?: string | null, scramble_subset?: string | null, scramble_top_color?: string | null, custom_cube_types?: Array<{ __typename?: 'CustomCubeType', id?: string | null, user_id?: string | null, name?: string | null, created_at?: any | null, scramble?: string | null, private?: boolean | null } | null> | null };

export type ImageFragmentFragment = { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null };

type PublicUserFragment_InternalUserAccount_Fragment = { __typename?: 'InternalUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null };

type PublicUserFragment_PublicUserAccount_Fragment = { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null };

type PublicUserFragment_UserAccount_Fragment = { __typename?: 'UserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null };

type PublicUserFragment_UserAccountForAdmin_Fragment = { __typename?: 'UserAccountForAdmin', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null };

export type PublicUserFragmentFragment = PublicUserFragment_InternalUserAccount_Fragment | PublicUserFragment_PublicUserAccount_Fragment | PublicUserFragment_UserAccount_Fragment | PublicUserFragment_UserAccountForAdmin_Fragment;

type UserAccountFragment_InternalUserAccount_Fragment = { __typename?: 'InternalUserAccount', email?: string | null, pending_email?: string | null, email_verified?: boolean | null, offline_hash?: string | null, id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null };

type UserAccountFragment_UserAccount_Fragment = { __typename?: 'UserAccount', email?: string | null, pending_email?: string | null, email_verified?: boolean | null, offline_hash?: string | null, id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null };

type UserAccountFragment_UserAccountForAdmin_Fragment = { __typename?: 'UserAccountForAdmin', email?: string | null, pending_email?: string | null, email_verified?: boolean | null, offline_hash?: string | null, id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null };

export type UserAccountFragmentFragment = UserAccountFragment_InternalUserAccount_Fragment | UserAccountFragment_UserAccount_Fragment | UserAccountFragment_UserAccountForAdmin_Fragment;

export type SolveWithUserFragmentFragment = { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, scramble_subset?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, is_virtual_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_rotations?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, phase_splits?: string | null, cube_id?: string | null, cube?: { __typename?: 'SolveCube', id?: string | null, name?: string | null, brand?: string | null, puzzle?: string | null, is_smart?: boolean | null } | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, case_key?: string | null, case_set?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null };

export type NotificationPreferenceFragmentFragment = { __typename?: 'NotificationPreference', marketing_emails?: boolean | null, support_ticket_reply?: boolean | null, zkt_competition_announced?: boolean | null, competition_groups_published?: boolean | null, competition_schedule_changed?: boolean | null, competition_results_official?: boolean | null, battle_challenge?: boolean | null };

export type NotificationFragmentFragment = { __typename?: 'Notification', id?: string | null, user_id?: string | null, notification_type?: string | null, notification_category_name?: string | null, triggering_user_id?: string | null, in_app_message?: string | null, read_at?: any | null, message?: string | null, icon?: string | null, link?: string | null, link_text?: string | null, subject?: string | null, created_at?: any | null, triggering_user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null };

export type TopSolveFragmentFragment = { __typename?: 'TopSolve', id?: string | null, time?: number | null, cube_type?: string | null, scramble_subset?: string | null, created_at?: any | null, solve?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, scramble_subset?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, is_virtual_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_rotations?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, phase_splits?: string | null, cube_id?: string | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, case_key?: string | null, case_set?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null };

export type TopAverageFragmentFragment = { __typename?: 'TopAverage', id?: string | null, time?: number | null, cube_type?: string | null, scramble_subset?: string | null, created_at?: any | null, solve_1?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, scramble_subset?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, is_virtual_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_rotations?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, phase_splits?: string | null, cube_id?: string | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, case_key?: string | null, case_set?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, solve_2?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, scramble_subset?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, is_virtual_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_rotations?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, phase_splits?: string | null, cube_id?: string | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, case_key?: string | null, case_set?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, solve_3?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, scramble_subset?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, is_virtual_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_rotations?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, phase_splits?: string | null, cube_id?: string | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, case_key?: string | null, case_set?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, solve_4?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, scramble_subset?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, is_virtual_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_rotations?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, phase_splits?: string | null, cube_id?: string | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, case_key?: string | null, case_set?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, solve_5?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, scramble_subset?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, is_virtual_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_rotations?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, phase_splits?: string | null, cube_id?: string | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, case_key?: string | null, case_set?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null };

export type ProfileFragmentFragment = { __typename?: 'Profile', id?: string | null, bio?: string | null, three_method?: string | null, three_goal?: string | null, main_three_cube?: string | null, favorite_event?: string | null, youtube_link?: string | null, twitter_link?: string | null, user_id?: string | null, reddit_link?: string | null, twitch_link?: string | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, top_solves?: Array<{ __typename?: 'TopSolve', id?: string | null, time?: number | null, cube_type?: string | null, scramble_subset?: string | null, created_at?: any | null, solve?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, scramble_subset?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, is_virtual_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_rotations?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, phase_splits?: string | null, cube_id?: string | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, case_key?: string | null, case_set?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null } | null> | null, top_averages?: Array<{ __typename?: 'TopAverage', id?: string | null, time?: number | null, cube_type?: string | null, scramble_subset?: string | null, created_at?: any | null, solve_1?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, scramble_subset?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, is_virtual_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_rotations?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, phase_splits?: string | null, cube_id?: string | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, case_key?: string | null, case_set?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, solve_2?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, scramble_subset?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, is_virtual_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_rotations?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, phase_splits?: string | null, cube_id?: string | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, case_key?: string | null, case_set?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, solve_3?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, scramble_subset?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, is_virtual_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_rotations?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, phase_splits?: string | null, cube_id?: string | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, case_key?: string | null, case_set?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, solve_4?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, scramble_subset?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, is_virtual_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_rotations?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, phase_splits?: string | null, cube_id?: string | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, case_key?: string | null, case_set?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, solve_5?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, scramble_subset?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, is_virtual_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_rotations?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, phase_splits?: string | null, cube_id?: string | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, case_key?: string | null, case_set?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null } | null> | null, header_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null, pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null };

export type ReportFragmentFragment = { __typename?: 'Report', id?: string | null, reported_user_id?: string | null, created_by_id?: string | null, reason?: string | null, resolved_at?: any | null, created_at?: any | null, alg_set_id?: string | null, created_by?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, reported_user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, alg_set?: { __typename?: 'ReportAlgSet', id?: string | null, code?: string | null, name?: string | null, visibility?: string | null, hidden?: boolean | null, hidden_reason?: string | null } | null };

export type IntegrationFragmentFragment = { __typename?: 'Integration', id?: string | null, auth_expires_at?: any | null, service_name?: IntegrationType | null, created_at?: any | null };

export type CustomTrainerFragmentFragment = { __typename?: 'CustomTrainer', id?: string | null, solution?: string | null, scrambles?: string | null, colors?: string | null, description?: string | null, alt_solutions?: string | null, group_name?: string | null, algo_type?: string | null, three_d?: boolean | null, cube_type?: string | null, name?: string | null, key?: string | null, copy_of_id?: string | null, copy_of?: { __typename?: 'CustomTrainer', user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null } | null } | null };

export type PublicCustomTrainerRecordFragmentFragment = { __typename?: 'CustomTrainer', user_id?: string | null, like_count?: number | null, id?: string | null, solution?: string | null, scrambles?: string | null, colors?: string | null, description?: string | null, alt_solutions?: string | null, group_name?: string | null, algo_type?: string | null, three_d?: boolean | null, cube_type?: string | null, name?: string | null, key?: string | null, copy_of_id?: string | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, copy_of?: { __typename?: 'CustomTrainer', user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null } | null } | null };

export type TimerBackgroundFragmentFragment = { __typename?: 'TimerBackground', created_at?: any | null, hex?: string | null, storage_path?: string | null, media_type?: string | null, mobile_storage_path?: string | null, mobile_media_type?: string | null, mobile_same_as_desktop?: boolean | null, id?: string | null, url?: string | null };

type UserForMeFragment_InternalUserAccount_Fragment = { __typename?: 'InternalUserAccount', email?: string | null, first_name?: string | null, last_name?: string | null, pending_email?: string | null, email_verified?: boolean | null, has_password?: boolean | null, join_country?: string | null, id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, timer_background?: { __typename?: 'TimerBackground', created_at?: any | null, hex?: string | null, storage_path?: string | null, media_type?: string | null, mobile_storage_path?: string | null, mobile_media_type?: string | null, mobile_same_as_desktop?: boolean | null, id?: string | null, url?: string | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null };

type UserForMeFragment_UserAccount_Fragment = { __typename?: 'UserAccount', email?: string | null, first_name?: string | null, last_name?: string | null, pending_email?: string | null, email_verified?: boolean | null, has_password?: boolean | null, join_country?: string | null, id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, timer_background?: { __typename?: 'TimerBackground', created_at?: any | null, hex?: string | null, storage_path?: string | null, media_type?: string | null, mobile_storage_path?: string | null, mobile_media_type?: string | null, mobile_same_as_desktop?: boolean | null, id?: string | null, url?: string | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null };

type UserForMeFragment_UserAccountForAdmin_Fragment = { __typename?: 'UserAccountForAdmin', email?: string | null, first_name?: string | null, last_name?: string | null, pending_email?: string | null, email_verified?: boolean | null, has_password?: boolean | null, join_country?: string | null, id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, timer_background?: { __typename?: 'TimerBackground', created_at?: any | null, hex?: string | null, storage_path?: string | null, media_type?: string | null, mobile_storage_path?: string | null, mobile_media_type?: string | null, mobile_same_as_desktop?: boolean | null, id?: string | null, url?: string | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null };

export type UserForMeFragmentFragment = UserForMeFragment_InternalUserAccount_Fragment | UserForMeFragment_UserAccount_Fragment | UserForMeFragment_UserAccountForAdmin_Fragment;

export type UserAccountSolvesSummaryFragmentFragment = { __typename?: 'UserAccountSolvesSummary', count?: number | null, average?: number | null, min_time?: number | null, max_time?: number | null, sum?: number | null, cube_type?: string | null, scramble_subset?: string | null };

export type UserAccountSummaryFragmentFragment = { __typename?: 'UserAccountSummary', solves?: number | null, reports_for?: number | null, reports_created?: number | null, profile_views?: number | null, bans?: number | null, timer_solves?: Array<{ __typename?: 'UserAccountSolvesSummary', count?: number | null, average?: number | null, min_time?: number | null, max_time?: number | null, sum?: number | null, cube_type?: string | null, scramble_subset?: string | null } | null> | null };

export type UserForAdminFragmentFragment = { __typename?: 'UserAccountForAdmin', email?: string | null, join_country?: string | null, join_ip?: string | null, id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, reports_for?: Array<{ __typename?: 'Report', id?: string | null, reported_user_id?: string | null, created_by_id?: string | null, reason?: string | null, resolved_at?: any | null, created_at?: any | null, alg_set_id?: string | null, created_by?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, reported_user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, alg_set?: { __typename?: 'ReportAlgSet', id?: string | null, code?: string | null, name?: string | null, visibility?: string | null, hidden?: boolean | null, hidden_reason?: string | null } | null } | null> | null, settings?: { __typename?: 'Setting', id?: string | null, user_id?: string | null, focus_mode?: boolean | null, freeze_time?: number | null, inspection?: boolean | null, manual_entry?: boolean | null, inspection_delay?: number | null, session_id?: string | null, inverse_time_list?: boolean | null, hide_time_when_solving?: boolean | null, nav_collapsed?: boolean | null, timer_decimal_points?: number | null, pb_confetti?: boolean | null, play_inspection_sound?: boolean | null, zero_out_time_after_solve?: boolean | null, confirm_delete_solve?: boolean | null, use_space_with_smart_cube?: boolean | null, use_2d_scramble_visual?: boolean | null, require_period_in_manual_time_entry?: boolean | null, cube_type?: string | null, scramble_subset?: string | null, scramble_top_color?: string | null, custom_cube_types?: Array<{ __typename?: 'CustomCubeType', id?: string | null, user_id?: string | null, name?: string | null, created_at?: any | null, scramble?: string | null, private?: boolean | null } | null> | null } | null, notification_preferences?: { __typename?: 'NotificationPreference', marketing_emails?: boolean | null, support_ticket_reply?: boolean | null, zkt_competition_announced?: boolean | null, competition_groups_published?: boolean | null, competition_schedule_changed?: boolean | null, competition_results_official?: boolean | null, battle_challenge?: boolean | null } | null, summary?: { __typename?: 'UserAccountSummary', solves?: number | null, reports_for?: number | null, reports_created?: number | null, profile_views?: number | null, bans?: number | null, timer_solves?: Array<{ __typename?: 'UserAccountSolvesSummary', count?: number | null, average?: number | null, min_time?: number | null, max_time?: number | null, sum?: number | null, cube_type?: string | null, scramble_subset?: string | null } | null> | null } | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null };

export type ReportSummaryFragmentFragment = { __typename?: 'ReportSummary', last_report?: any | null, first_report?: any | null, count?: number | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, reports?: Array<{ __typename?: 'Report', id?: string | null, reported_user_id?: string | null, created_by_id?: string | null, reason?: string | null, resolved_at?: any | null, created_at?: any | null, alg_set_id?: string | null, created_by?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, reported_user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, alg_set?: { __typename?: 'ReportAlgSet', id?: string | null, code?: string | null, name?: string | null, visibility?: string | null, hidden?: boolean | null, hidden_reason?: string | null } | null } | null> | null };

export type DmSolveFragmentFragment = { __typename?: 'Solve', id?: string | null, time?: number | null, dnf?: boolean | null, plus_two?: boolean | null, cube_type?: string | null, scramble_subset?: string | null, scramble?: string | null, share_code?: string | null, is_smart_cube?: boolean | null, is_virtual_cube?: boolean | null, created_at?: any | null };

export type MessageFragmentFragment = { __typename?: 'Message', id?: string | null, conversation_id?: string | null, sender_id?: string | null, body?: string | null, created_at?: any | null, edited_at?: any | null, reactions?: Array<{ __typename?: 'MessageReaction', user_id?: string | null, emoji?: string | null }> | null, reply_to?: { __typename?: 'ReplyPreview', id?: string | null, sender_id?: string | null, body?: string | null, deleted_at?: any | null, solve_id?: string | null, sender?: { __typename?: 'ReplyPreviewSender', username?: string | null } | null } | null, sender?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, solve?: { __typename?: 'Solve', id?: string | null, time?: number | null, dnf?: boolean | null, plus_two?: boolean | null, cube_type?: string | null, scramble_subset?: string | null, scramble?: string | null, share_code?: string | null, is_smart_cube?: boolean | null, is_virtual_cube?: boolean | null, created_at?: any | null } | null };

export type ConversationViewFragmentFragment = { __typename?: 'ConversationView', id?: string | null, unread_count?: number | null, accepted?: boolean | null, muted?: boolean | null, last_message_at?: any | null, other_user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, last_message?: { __typename?: 'Message', id?: string | null, conversation_id?: string | null, sender_id?: string | null, body?: string | null, created_at?: any | null, edited_at?: any | null, reactions?: Array<{ __typename?: 'MessageReaction', user_id?: string | null, emoji?: string | null }> | null, reply_to?: { __typename?: 'ReplyPreview', id?: string | null, sender_id?: string | null, body?: string | null, deleted_at?: any | null, solve_id?: string | null, sender?: { __typename?: 'ReplyPreviewSender', username?: string | null } | null } | null, sender?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, solve?: { __typename?: 'Solve', id?: string | null, time?: number | null, dnf?: boolean | null, plus_two?: boolean | null, cube_type?: string | null, scramble_subset?: string | null, scramble?: string | null, share_code?: string | null, is_smart_cube?: boolean | null, is_virtual_cube?: boolean | null, created_at?: any | null } | null } | null };

export type LinkRevenueCatUserMutationVariables = Exact<{ [key: string]: never; }>;


export type LinkRevenueCatUserMutation = { __typename?: 'Mutation', linkRevenueCatUser?: boolean | null };

export type CreateSupportTicketMutationVariables = Exact<{
  input: SupportTicketInput;
}>;


export type CreateSupportTicketMutation = { __typename?: 'Mutation', createSupportTicket?: { __typename?: 'SupportTicket', id?: string | null } | null };

export type ResolveSupportTicketMutationVariables = Exact<{
  id: Scalars['String'];
}>;


export type ResolveSupportTicketMutation = { __typename?: 'Mutation', resolveSupportTicket?: { __typename?: 'SupportTicket', id?: string | null, resolved_at?: any | null } | null };

export type AddSupportTicketMessageMutationVariables = Exact<{
  ticketId: Scalars['String'];
  body: Scalars['String'];
  attachments?: InputMaybe<Array<Scalars['Upload']> | Scalars['Upload']>;
}>;


export type AddSupportTicketMessageMutation = { __typename?: 'Mutation', addSupportTicketMessage?: { __typename?: 'SupportTicketMessage', id?: string | null, body?: string | null, is_admin?: boolean | null, created_at?: any | null, attachments?: Array<{ __typename?: 'SupportTicketAttachment', id?: string | null, storage_path?: string | null, mime_type?: string | null, kind?: string | null, size_bytes?: number | null, original_name?: string | null }> | null } | null };

export type UpdateLocaleMutationVariables = Exact<{
  locale: Scalars['String'];
}>;


export type UpdateLocaleMutation = { __typename?: 'Mutation', setSetting?: { __typename?: 'Setting', id?: string | null } | null };

export type VoteReconstructionMutationVariables = Exact<{
  id: Scalars['String'];
  vote: Scalars['Int'];
}>;


export type VoteReconstructionMutation = { __typename?: 'Mutation', voteReconstruction?: boolean | null };

export type UpdateSiteConfigMutationVariables = Exact<{
  input: UpdateSiteConfigInput;
}>;


export type UpdateSiteConfigMutation = { __typename?: 'Mutation', updateSiteConfig?: { __typename?: 'SiteConfig', id?: string | null, maintenance_mode?: boolean | null, trainer_enabled?: boolean | null, community_enabled?: boolean | null, leaderboards_enabled?: boolean | null, rooms_enabled?: boolean | null, battle_enabled?: boolean | null, messaging_enabled?: boolean | null, presence_enabled?: boolean | null, pro_enabled?: boolean | null, wca_backfill_enabled?: boolean | null, zkt_backfill_enabled?: boolean | null, smart_telemetry_enabled?: boolean | null, magnet_telemetry_enabled?: boolean | null, online_battle_enabled?: boolean | null, updated_at?: any | null, featureOverrides?: Array<{ __typename?: 'FeatureOverrideEntry', feature?: string | null, mode?: string | null, users?: Array<{ __typename?: 'FeatureOverrideUser', id?: string | null, username?: string | null } | null> | null } | null> | null } | null };

export type MergeSessionsMutationVariables = Exact<{
  oldSessionId?: InputMaybe<Scalars['String']>;
  newSessionId?: InputMaybe<Scalars['String']>;
}>;


export type MergeSessionsMutation = { __typename?: 'Mutation', mergeSessions?: { __typename?: 'Session', id?: string | null, name?: string | null, created_at?: any | null, order?: number | null } | null };

export type SplitSessionMutationVariables = Exact<{
  sessionId: Scalars['String'];
  buckets: Array<SessionBucketInput> | SessionBucketInput;
  name: Scalars['String'];
}>;


export type SplitSessionMutation = { __typename?: 'Mutation', splitSession?: { __typename?: 'Session', id?: string | null, name?: string | null, created_at?: any | null, order?: number | null } | null };

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

export type BulkDeleteSessionsMutationVariables = Exact<{
  ids: Array<InputMaybe<Scalars['String']>> | InputMaybe<Scalars['String']>;
}>;


export type BulkDeleteSessionsMutation = { __typename?: 'Mutation', bulkDeleteSessions?: any | null };

export type CreateAnnouncementMutationVariables = Exact<{
  input: CreateAnnouncementInput;
}>;


export type CreateAnnouncementMutation = { __typename?: 'Mutation', createAnnouncement?: { __typename?: 'Announcement', id?: string | null, title?: string | null, category?: string | null, isDraft?: boolean | null, targetUrl?: string | null } | null };

export type UpdateAnnouncementMutationVariables = Exact<{
  id: Scalars['String'];
  input: UpdateAnnouncementInput;
}>;


export type UpdateAnnouncementMutation = { __typename?: 'Mutation', updateAnnouncement?: { __typename?: 'Announcement', id?: string | null, title?: string | null, category?: string | null, isDraft?: boolean | null, targetUrl?: string | null } | null };

export type MarkAnnouncementAsViewedMutationVariables = Exact<{
  announcementId: Scalars['String'];
}>;


export type MarkAnnouncementAsViewedMutation = { __typename?: 'Mutation', markAnnouncementAsViewed?: boolean | null };

export type DeleteAnnouncementMutationVariables = Exact<{
  id: Scalars['String'];
}>;


export type DeleteAnnouncementMutation = { __typename?: 'Mutation', deleteAnnouncement?: boolean | null };

export type TranslateAnnouncementContentMutationVariables = Exact<{
  title: Scalars['String'];
  content: Scalars['String'];
}>;


export type TranslateAnnouncementContentMutation = { __typename?: 'Mutation', translateAnnouncementContent?: { __typename?: 'TranslateAnnouncementResult', title?: { __typename?: 'TranslatedText', en?: string | null, es?: string | null, ru?: string | null, zh?: string | null } | null, content?: { __typename?: 'TranslatedText', en?: string | null, es?: string | null, ru?: string | null, zh?: string | null } | null } | null };

export type AdminDeleteTrainerAlternativeMutationVariables = Exact<{
  id: Scalars['String'];
}>;


export type AdminDeleteTrainerAlternativeMutation = { __typename?: 'Mutation', adminDeleteTrainerAlternative?: { __typename?: 'TrainerAlternative', id?: string | null } | null };

export type BackfillWcaIdsMutationVariables = Exact<{ [key: string]: never; }>;


export type BackfillWcaIdsMutation = { __typename?: 'Mutation', backfillWcaIds?: { __typename?: 'BackfillResult', total?: number | null, filled?: number | null, tokenFailed?: number | null, noWcaId?: number | null, error?: number | null, recordsTotal?: number | null, recordsFilled?: number | null, recordsError?: number | null } | null };

export type BackfillZktIdsMutationVariables = Exact<{ [key: string]: never; }>;


export type BackfillZktIdsMutation = { __typename?: 'Mutation', backfillZktIds?: { __typename?: 'ZktBackfillResult', total?: number | null, filled?: number | null, stillNull?: number | null, conflict?: number | null, error?: number | null } | null };

export type FollowCompetitorMutationVariables = Exact<{
  input: FollowCompetitorInput;
}>;


export type FollowCompetitorMutation = { __typename?: 'Mutation', followCompetitor?: { __typename?: 'CompetitionFollow', id?: string | null, competition_id?: string | null, followed_registrant_id?: number | null, followed_wca_id?: string | null, followed_name?: string | null, created_at?: any | null } | null };

export type UnfollowCompetitorMutationVariables = Exact<{
  id: Scalars['String'];
}>;


export type UnfollowCompetitorMutation = { __typename?: 'Mutation', unfollowCompetitor?: boolean | null };

export type RecordActivityHeartbeatMutationVariables = Exact<{ [key: string]: never; }>;


export type RecordActivityHeartbeatMutation = { __typename?: 'Mutation', recordActivityHeartbeat?: { __typename?: 'ActivityHeartbeatResult', success?: boolean | null } | null };

export type SendMessageMutationVariables = Exact<{
  body: Scalars['String'];
  recipientId?: InputMaybe<Scalars['String']>;
  conversationId?: InputMaybe<Scalars['String']>;
  solveId?: InputMaybe<Scalars['String']>;
  replyToId?: InputMaybe<Scalars['String']>;
}>;


export type SendMessageMutation = { __typename?: 'Mutation', sendMessage?: { __typename?: 'Message', id?: string | null, conversation_id?: string | null, sender_id?: string | null, body?: string | null, created_at?: any | null, edited_at?: any | null, reactions?: Array<{ __typename?: 'MessageReaction', user_id?: string | null, emoji?: string | null }> | null, reply_to?: { __typename?: 'ReplyPreview', id?: string | null, sender_id?: string | null, body?: string | null, deleted_at?: any | null, solve_id?: string | null, sender?: { __typename?: 'ReplyPreviewSender', username?: string | null } | null } | null, sender?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, solve?: { __typename?: 'Solve', id?: string | null, time?: number | null, dnf?: boolean | null, plus_two?: boolean | null, cube_type?: string | null, scramble_subset?: string | null, scramble?: string | null, share_code?: string | null, is_smart_cube?: boolean | null, is_virtual_cube?: boolean | null, created_at?: any | null } | null } | null };

export type MarkConversationReadMutationVariables = Exact<{
  conversationId: Scalars['String'];
}>;


export type MarkConversationReadMutation = { __typename?: 'Mutation', markConversationRead?: boolean | null };

export type ArchiveConversationMutationVariables = Exact<{
  conversationId: Scalars['String'];
}>;


export type ArchiveConversationMutation = { __typename?: 'Mutation', archiveConversation?: boolean | null };

export type SetMessageReactionMutationVariables = Exact<{
  messageId: Scalars['String'];
  emoji?: InputMaybe<Scalars['String']>;
}>;


export type SetMessageReactionMutation = { __typename?: 'Mutation', setMessageReaction?: boolean | null };

export type SetConversationMutedMutationVariables = Exact<{
  conversationId: Scalars['String'];
  muted: Scalars['Boolean'];
}>;


export type SetConversationMutedMutation = { __typename?: 'Mutation', setConversationMuted?: boolean | null };

export type AcceptConversationRequestMutationVariables = Exact<{
  conversationId: Scalars['String'];
}>;


export type AcceptConversationRequestMutation = { __typename?: 'Mutation', acceptConversationRequest?: boolean | null };

export type EditMessageMutationVariables = Exact<{
  messageId: Scalars['String'];
  body: Scalars['String'];
}>;


export type EditMessageMutation = { __typename?: 'Mutation', editMessage?: { __typename?: 'Message', id?: string | null, conversation_id?: string | null, sender_id?: string | null, body?: string | null, created_at?: any | null, edited_at?: any | null, reactions?: Array<{ __typename?: 'MessageReaction', user_id?: string | null, emoji?: string | null }> | null, reply_to?: { __typename?: 'ReplyPreview', id?: string | null, sender_id?: string | null, body?: string | null, deleted_at?: any | null, solve_id?: string | null, sender?: { __typename?: 'ReplyPreviewSender', username?: string | null } | null } | null, sender?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, solve?: { __typename?: 'Solve', id?: string | null, time?: number | null, dnf?: boolean | null, plus_two?: boolean | null, cube_type?: string | null, scramble_subset?: string | null, scramble?: string | null, share_code?: string | null, is_smart_cube?: boolean | null, is_virtual_cube?: boolean | null, created_at?: any | null } | null } | null };

export type UnsendMessageMutationVariables = Exact<{
  messageId: Scalars['String'];
}>;


export type UnsendMessageMutation = { __typename?: 'Mutation', unsendMessage?: boolean | null };

export type ClearConversationMutationVariables = Exact<{
  conversationId: Scalars['String'];
}>;


export type ClearConversationMutation = { __typename?: 'Mutation', clearConversation?: boolean | null };

export type SetTypingMutationVariables = Exact<{
  conversationId: Scalars['String'];
  typing: Scalars['Boolean'];
}>;


export type SetTypingMutation = { __typename?: 'Mutation', setTyping?: boolean | null };

export type ReportConversationMutationVariables = Exact<{
  conversationId: Scalars['String'];
  reason: Scalars['String'];
}>;


export type ReportConversationMutation = { __typename?: 'Mutation', reportConversation?: boolean | null };

export type ResolveMessageReportMutationVariables = Exact<{
  reportId: Scalars['String'];
  action: ReportStatus;
  note?: InputMaybe<Scalars['String']>;
}>;


export type ResolveMessageReportMutation = { __typename?: 'Mutation', resolveMessageReport?: boolean | null };

export type BlockUserMutationVariables = Exact<{
  userId: Scalars['String'];
}>;


export type BlockUserMutation = { __typename?: 'Mutation', blockUser?: boolean | null };

export type UnblockUserMutationVariables = Exact<{
  userId: Scalars['String'];
}>;


export type UnblockUserMutation = { __typename?: 'Mutation', unblockUser?: boolean | null };

export type UpdateSocialPreferenceMutationVariables = Exact<{
  input: UpdateSocialPreferenceInput;
}>;


export type UpdateSocialPreferenceMutation = { __typename?: 'Mutation', updateSocialPreference?: { __typename?: 'SocialPreference', dm_policy?: DmPolicy | null, searchable?: boolean | null, dm_push?: boolean | null, read_receipts?: boolean | null, typing_indicator?: boolean | null, online_status?: boolean | null } | null };

export type RecordSmartCubeTelemetryMutationVariables = Exact<{
  events: Array<SmartCubeTelemetryInput> | SmartCubeTelemetryInput;
}>;


export type RecordSmartCubeTelemetryMutation = { __typename?: 'Mutation', recordSmartCubeTelemetry?: { __typename?: 'SmartCubeTelemetryResult', accepted?: number | null } | null };

export type RecordMagnetTelemetryMutationVariables = Exact<{
  events: Array<MagnetTelemetryInput> | MagnetTelemetryInput;
}>;


export type RecordMagnetTelemetryMutation = { __typename?: 'Mutation', recordMagnetTelemetry?: { __typename?: 'MagnetTelemetryResult', accepted?: number | null, enabled?: boolean | null } | null };

export type RecordProfileViewMutationVariables = Exact<{
  username: Scalars['String'];
}>;


export type RecordProfileViewMutation = { __typename?: 'Mutation', recordProfileView: boolean };

export type RecordSolveViewMutationVariables = Exact<{
  shareCode: Scalars['String'];
}>;


export type RecordSolveViewMutation = { __typename?: 'Mutation', recordSolveView: boolean };

export type AdminSupportTicketsQueryVariables = Exact<{
  resolved?: InputMaybe<Scalars['Boolean']>;
}>;


export type AdminSupportTicketsQuery = { __typename?: 'Query', supportTickets?: Array<{ __typename?: 'SupportTicket', id?: string | null, created_at?: any | null, subject?: string | null, message?: string | null, resolved_at?: any | null, created_by_id?: string | null, created_by?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, messages?: Array<{ __typename?: 'SupportTicketMessage', id?: string | null, body?: string | null, is_admin?: boolean | null, created_at?: any | null, sender?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, attachments?: Array<{ __typename?: 'SupportTicketAttachment', id?: string | null, storage_path?: string | null, mime_type?: string | null, kind?: string | null, size_bytes?: number | null, original_name?: string | null }> | null }> | null } | null> | null };

export type MySupportTicketsQueryVariables = Exact<{ [key: string]: never; }>;


export type MySupportTicketsQuery = { __typename?: 'Query', mySupportTickets?: Array<{ __typename?: 'SupportTicket', id?: string | null, created_at?: any | null, subject?: string | null, message?: string | null, resolved_at?: any | null, created_by_id?: string | null, messages?: Array<{ __typename?: 'SupportTicketMessage', id?: string | null, body?: string | null, is_admin?: boolean | null, created_at?: any | null, sender?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, attachments?: Array<{ __typename?: 'SupportTicketAttachment', id?: string | null, storage_path?: string | null, mime_type?: string | null, kind?: string | null, size_bytes?: number | null, original_name?: string | null }> | null }> | null } | null> | null };

export type SupportTicketDetailQueryVariables = Exact<{
  id: Scalars['String'];
}>;


export type SupportTicketDetailQuery = { __typename?: 'Query', supportTicket?: { __typename?: 'SupportTicket', id?: string | null, created_at?: any | null, subject?: string | null, message?: string | null, resolved_at?: any | null, created_by_id?: string | null, created_by?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, messages?: Array<{ __typename?: 'SupportTicketMessage', id?: string | null, body?: string | null, is_admin?: boolean | null, created_at?: any | null, sender?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, attachments?: Array<{ __typename?: 'SupportTicketAttachment', id?: string | null, storage_path?: string | null, mime_type?: string | null, kind?: string | null, size_bytes?: number | null, original_name?: string | null }> | null }> | null } | null };

export type GetIapStatusQueryVariables = Exact<{ [key: string]: never; }>;


export type GetIapStatusQuery = { __typename?: 'Query', getIapStatus?: { __typename?: 'IapStatus', is_pro?: boolean | null, pro_expires_at?: any | null, iap_platform?: string | null, iap_product_id?: string | null, iap_cancellation_at?: any | null, iap_billing_issue_at?: any | null, iap_paused_until?: any | null, is_iap_pro?: boolean | null, can_purchase?: boolean | null } | null };

export type TrainerOptionsSettingQueryVariables = Exact<{ [key: string]: never; }>;


export type TrainerOptionsSettingQuery = { __typename?: 'Query', settings?: { __typename?: 'Setting', id?: string | null, trainer_options?: string | null } | null };

export type SiteConfigQueryVariables = Exact<{ [key: string]: never; }>;


export type SiteConfigQuery = { __typename?: 'Query', siteConfig?: { __typename?: 'SiteConfig', id?: string | null, maintenance_mode?: boolean | null, trainer_enabled?: boolean | null, community_enabled?: boolean | null, leaderboards_enabled?: boolean | null, rooms_enabled?: boolean | null, battle_enabled?: boolean | null, messaging_enabled?: boolean | null, presence_enabled?: boolean | null, pro_enabled?: boolean | null, wca_backfill_enabled?: boolean | null, zkt_backfill_enabled?: boolean | null, smart_telemetry_enabled?: boolean | null, magnet_telemetry_enabled?: boolean | null, online_battle_enabled?: boolean | null, method_steps_version?: number | null, updated_at?: any | null, featureOverrides?: Array<{ __typename?: 'FeatureOverrideEntry', feature?: string | null, mode?: string | null, users?: Array<{ __typename?: 'FeatureOverrideUser', id?: string | null, username?: string | null } | null> | null } | null> | null } | null };

export type OnlineStatsQueryVariables = Exact<{ [key: string]: never; }>;


export type OnlineStatsQuery = { __typename?: 'Query', onlineStats?: { __typename?: 'OnlineStats', totalSockets?: number | null, uniqueUsers?: number | null, anonymous?: number | null } | null };

export type WcaStatsQueryVariables = Exact<{ [key: string]: never; }>;


export type WcaStatsQuery = { __typename?: 'Query', wcaStats?: { __typename?: 'WcaStats', totalUsers?: number | null, wcaConnected?: number | null, wcaWithId?: number | null, wcaWithoutId?: number | null } | null };

export type OnlineUsersQueryVariables = Exact<{ [key: string]: never; }>;


export type OnlineUsersQuery = { __typename?: 'Query', onlineUsers?: Array<{ __typename?: 'OnlineUser', tabCount?: number | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null } | null> | null };

export type SolveByShareCodeQueryVariables = Exact<{
  shareCode?: InputMaybe<Scalars['String']>;
}>;


export type SolveByShareCodeQuery = { __typename?: 'Query', solveByShareCode?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, scramble_subset?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, is_virtual_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_rotations?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, phase_splits?: string | null, cube_id?: string | null, cube?: { __typename?: 'SolveCube', id?: string | null, name?: string | null, brand?: string | null, puzzle?: string | null, is_smart?: boolean | null } | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, case_key?: string | null, case_set?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null };

export type SolveReplayDataQueryVariables = Exact<{
  id: Scalars['String'];
  shareCode?: InputMaybe<Scalars['String']>;
}>;


export type SolveReplayDataQuery = { __typename?: 'Query', solveReplayData?: { __typename?: 'SolveReplayData', smart_gyro?: string | null, reconstruction_vote?: number | null, is_owner?: boolean | null } | null };

export type ProfileQueryVariables = Exact<{
  username?: InputMaybe<Scalars['String']>;
}>;


export type ProfileQuery = { __typename?: 'Query', profile: { __typename?: 'Profile', id?: string | null, bio?: string | null, three_method?: string | null, three_goal?: string | null, main_three_cube?: string | null, favorite_event?: string | null, youtube_link?: string | null, twitter_link?: string | null, user_id?: string | null, reddit_link?: string | null, twitch_link?: string | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, top_solves?: Array<{ __typename?: 'TopSolve', id?: string | null, time?: number | null, cube_type?: string | null, scramble_subset?: string | null, created_at?: any | null, solve?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, scramble_subset?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, is_virtual_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_rotations?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, phase_splits?: string | null, cube_id?: string | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, case_key?: string | null, case_set?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null } | null> | null, top_averages?: Array<{ __typename?: 'TopAverage', id?: string | null, time?: number | null, cube_type?: string | null, scramble_subset?: string | null, created_at?: any | null, solve_1?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, scramble_subset?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, is_virtual_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_rotations?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, phase_splits?: string | null, cube_id?: string | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, case_key?: string | null, case_set?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, solve_2?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, scramble_subset?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, is_virtual_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_rotations?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, phase_splits?: string | null, cube_id?: string | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, case_key?: string | null, case_set?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, solve_3?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, scramble_subset?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, is_virtual_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_rotations?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, phase_splits?: string | null, cube_id?: string | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, case_key?: string | null, case_set?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, solve_4?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, scramble_subset?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, is_virtual_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_rotations?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, phase_splits?: string | null, cube_id?: string | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, case_key?: string | null, case_set?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, solve_5?: { __typename?: 'Solve', id?: string | null, time?: number | null, raw_time?: number | null, cube_type?: string | null, scramble_subset?: string | null, user_id?: string | null, scramble?: string | null, session_id?: string | null, started_at?: any | null, ended_at?: any | null, dnf?: boolean | null, plus_two?: boolean | null, notes?: string | null, created_at?: any | null, is_smart_cube?: boolean | null, is_virtual_cube?: boolean | null, smart_turn_count?: number | null, share_code?: string | null, smart_turns?: string | null, smart_rotations?: string | null, smart_put_down_time?: number | null, inspection_time?: number | null, phase_splits?: string | null, cube_id?: string | null, solve_method_steps?: Array<{ __typename?: 'SolveMethodStep', id?: string | null, turn_count?: number | null, turns?: string | null, total_time?: number | null, tps?: number | null, recognition_time?: number | null, oll_case_key?: string | null, pll_case_key?: string | null, case_key?: string | null, case_set?: string | null, skipped?: boolean | null, parent_name?: string | null, method_name?: string | null, step_index?: number | null, step_name?: string | null, created_at?: any | null } | null> | null } | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null } | null> | null, header_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null, pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } };

export type UserSearchQueryVariables = Exact<{
  pageArgs?: InputMaybe<PaginationArgsInput>;
}>;


export type UserSearchQuery = { __typename?: 'Query', userSearch?: { __typename?: 'PaginatedUserAccounts', hasMore?: boolean | null, total?: number | null, items?: Array<{ __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null> | null } | null };

export type AdminUserSearchQueryVariables = Exact<{
  pageArgs?: InputMaybe<PaginationArgsInput>;
}>;


export type AdminUserSearchQuery = { __typename?: 'Query', adminUserSearch?: { __typename?: 'PaginatedUserAccountsForAdmin', hasMore?: boolean | null, total?: number | null, items?: Array<{ __typename?: 'UserAccountForAdmin', email?: string | null, pending_email?: string | null, email_verified?: boolean | null, offline_hash?: string | null, id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null> | null } | null };

export type GetActiveAnnouncementsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetActiveAnnouncementsQuery = { __typename?: 'Query', getActiveAnnouncements?: Array<{ __typename?: 'Announcement', id?: string | null, title?: string | null, content?: string | null, category?: string | null, priority?: number | null, imageUrl?: string | null, targetUrl?: string | null, createdAt?: any | null, hasViewed?: boolean | null, showInApp?: boolean | null } | null> | null };

export type GetAllAnnouncementsQueryVariables = Exact<{
  filter?: InputMaybe<AnnouncementFilterInput>;
}>;


export type GetAllAnnouncementsQuery = { __typename?: 'Query', getAllAnnouncements?: Array<{ __typename?: 'Announcement', id?: string | null, title?: string | null, content?: string | null, category?: string | null, priority?: number | null, imageUrl?: string | null, targetUrl?: string | null, translations?: string | null, isDraft?: boolean | null, isActive?: boolean | null, showInApp?: boolean | null, createdAt?: any | null, publishedAt?: any | null, viewCount?: number | null, pushSentAt?: any | null, pushSuccessCount?: number | null, pushTargetCount?: number | null } | null> | null };

export type GetMyAnnouncementHistoryQueryVariables = Exact<{
  limit: Scalars['Int'];
  offset: Scalars['Int'];
}>;


export type GetMyAnnouncementHistoryQuery = { __typename?: 'Query', getMyAnnouncementHistory?: Array<{ __typename?: 'Announcement', id?: string | null, title?: string | null, content?: string | null, category?: string | null, priority?: number | null, imageUrl?: string | null, targetUrl?: string | null, createdAt?: any | null } | null> | null };

export type TrainerAlternativesQueryVariables = Exact<{
  category: Scalars['String'];
  caseName: Scalars['String'];
}>;


export type TrainerAlternativesQuery = { __typename?: 'Query', trainerAlternatives?: Array<{ __typename?: 'TrainerAlternative', id?: string | null, algorithm?: string | null, original_input?: string | null, setup?: string | null, ll_pattern?: string | null, created_at?: any | null } | null> | null };

export type TrainerLibraryQueryVariables = Exact<{
  knownVersion?: InputMaybe<Scalars['String']>;
}>;


export type TrainerLibraryQuery = { __typename?: 'Query', trainerLibrary?: { __typename?: 'TrainerLibrary', version?: string | null, categories?: Array<{ __typename?: 'TrainerLibraryCategory', category?: string | null, subsets?: Array<{ __typename?: 'TrainerLibrarySubset', subset?: string | null, algorithms?: Array<{ __typename?: 'TrainerLibraryEntry', name?: string | null, algorithm?: string | null, setup?: string | null, alternativeCount?: number | null } | null> | null } | null> | null }> | null } | null };

export type TrainerLibraryAlternativesQueryVariables = Exact<{
  category: Scalars['String'];
}>;


export type TrainerLibraryAlternativesQuery = { __typename?: 'Query', trainerLibraryAlternatives?: { __typename?: 'TrainerLibraryAlternatives', version?: string | null, category?: string | null, cases?: Array<{ __typename?: 'TrainerCaseAlternatives', name?: string | null, alternatives?: Array<string | null> | null } | null> | null } | null };

export type WcaCompetitionsQueryVariables = Exact<{
  filter?: InputMaybe<WcaCompetitionFilterInput>;
}>;


export type WcaCompetitionsQuery = { __typename?: 'Query', wcaCompetitions?: Array<{ __typename?: 'WcaCompetition', id?: string | null, name?: string | null, city?: string | null, country_iso2?: string | null, venue?: string | null, start_date?: string | null, end_date?: string | null, date_range?: string | null, event_ids?: Array<string | null> | null, latitude_degrees?: number | null, longitude_degrees?: number | null, url?: string | null, competitor_limit?: number | null } | null> | null };

export type WcaSearchCompetitionsQueryVariables = Exact<{
  query: Scalars['String'];
}>;


export type WcaSearchCompetitionsQuery = { __typename?: 'Query', wcaSearchCompetitions?: Array<{ __typename?: 'WcaCompetition', id?: string | null, name?: string | null, city?: string | null, country_iso2?: string | null, start_date?: string | null, end_date?: string | null, event_ids?: Array<string | null> | null, url?: string | null } | null> | null };

export type MyWcaCompetitionsQueryVariables = Exact<{ [key: string]: never; }>;


export type MyWcaCompetitionsQuery = { __typename?: 'Query', myWcaCompetitions?: Array<{ __typename?: 'WcaCompetition', id?: string | null, name?: string | null, city?: string | null, country_iso2?: string | null, start_date?: string | null, end_date?: string | null, event_ids?: Array<string | null> | null, url?: string | null } | null> | null };

export type WcaCompetitionDetailQueryVariables = Exact<{
  input: WcaScheduleInput;
}>;


export type WcaCompetitionDetailQuery = { __typename?: 'Query', wcaCompetitionDetail?: { __typename?: 'WcaCompetitionDetail', competitionId?: string | null, competitionName?: string | null, myWcaId?: string | null, myRegistrantId?: number | null, myRegistrationStatus?: string | null, myRegisteredEvents?: Array<string | null> | null, myDayLabel?: string | null, wcaLiveCompId?: string | null, days?: Array<{ __typename?: 'WcaCompetitionDay', position?: number | null, label?: string | null, date?: string | null, named?: boolean | null }> | null, competitors?: Array<{ __typename?: 'WcaCompetitor', name?: string | null, wcaId?: string | null, zktId?: string | null, country?: string | null, avatar?: string | null, registrantId?: number | null, wcaUserId?: number | null, registeredEvents?: Array<string | null> | null, dayLabel?: string | null, assignments?: Array<{ __typename?: 'WcaCompetitorAssignment', activityCode?: string | null, eventName?: string | null, roundNumber?: number | null, groupNumber?: number | null, assignmentCode?: string | null, startTime?: string | null, endTime?: string | null, stationNumber?: number | null, roomName?: string | null, chance?: number | null } | null> | null, personalBests?: Array<{ __typename?: 'WcaPersonalBest', eventId?: string | null, type?: string | null, best?: number | null, worldRanking?: number | null, continentalRanking?: number | null, nationalRanking?: number | null } | null> | null } | null> | null, events?: Array<{ __typename?: 'WcaEventDetail', eventId?: string | null, eventName?: string | null, dayLabel?: string | null, rounds?: Array<{ __typename?: 'WcaRound', roundNumber?: number | null, format?: string | null, timeLimit?: number | null, cutoff?: number | null, cutoffAttempts?: number | null, advancementType?: string | null, advancementLevel?: number | null, dualChance?: boolean | null, groups?: Array<{ __typename?: 'WcaGroup', groupNumber?: number | null, activityCode?: string | null, startTime?: string | null, endTime?: string | null, chance?: number | null, competitors?: Array<{ __typename?: 'WcaGroupCompetitor', name?: string | null, wcaId?: string | null, registrantId?: number | null, assignmentCode?: string | null, seedResult?: number | null } | null> | null } | null> | null } | null> | null } | null> | null, schedule?: Array<{ __typename?: 'WcaScheduleDay', date?: string | null, assignments?: Array<{ __typename?: 'WcaScheduleAssignment', activityCode?: string | null, eventName?: string | null, roundNumber?: number | null, groupNumber?: number | null, assignmentCode?: string | null, startTime?: string | null, endTime?: string | null, roomName?: string | null, roomColor?: string | null, venueName?: string | null, stationNumber?: number | null, chance?: number | null } | null> | null } | null> | null, allPersonalBests?: Array<{ __typename?: 'WcaRankingRow', name?: string | null, wcaId?: string | null, registrantId?: number | null, eventId?: string | null, single?: number | null, average?: number | null, singleWorldRank?: number | null, averageWorldRank?: number | null } | null> | null, wcaLiveCompetitors?: Array<{ __typename?: 'WcaLiveCompetitor', wcaId?: string | null, liveId?: string | null, name?: string | null } | null> | null, wcaLiveRoundMap?: Array<{ __typename?: 'WcaLiveRoundMapping', activityCode?: string | null, liveRoundId?: string | null } | null> | null, info?: { __typename?: 'WcaCompetitionInfo', wcaUrl?: string | null, venues?: Array<{ __typename?: 'WcaVenueInfo', name?: string | null, address?: string | null, city?: string | null } | null> | null, organizers?: Array<{ __typename?: 'WcaPersonInfo', name?: string | null, wcaId?: string | null, role?: string | null, avatar?: string | null } | null> | null, delegates?: Array<{ __typename?: 'WcaPersonInfo', name?: string | null, wcaId?: string | null, role?: string | null, avatar?: string | null } | null> | null } | null } | null };

export type WcaLiveCompetitionOverviewQueryVariables = Exact<{
  input: WcaLiveOverviewInput;
}>;


export type WcaLiveCompetitionOverviewQuery = { __typename?: 'Query', wcaLiveCompetitionOverview?: { __typename?: 'WcaLiveCompetitionOverview', compId?: string | null, name?: string | null, events?: Array<{ __typename?: 'WcaLiveEventInfo', eventId?: string | null, eventName?: string | null, rounds?: Array<{ __typename?: 'WcaLiveRoundInfo', liveRoundId?: string | null, number?: number | null, name?: string | null, open?: boolean | null, finished?: boolean | null, active?: boolean | null, numEntered?: number | null, numResults?: number | null, dayIndex?: number | null, dayLabel?: string | null, isFinal?: boolean | null, dualChance?: boolean | null, format?: { __typename?: 'WcaLiveFormat', numberOfAttempts?: number | null, sortBy?: string | null } | null, timeLimit?: { __typename?: 'WcaLiveTimeLimit', centiseconds?: number | null, cumulativeRoundWcifIds?: Array<string | null> | null } | null, cutoff?: { __typename?: 'WcaLiveCutoff', attemptResult?: number | null, numberOfAttempts?: number | null } | null, advancementCondition?: { __typename?: 'WcaLiveAdvancementCondition', type?: string | null, level?: number | null } | null } | null> | null } | null> | null, schedule?: Array<{ __typename?: 'WcaLiveScheduleVenue', name?: string | null, rooms?: Array<{ __typename?: 'WcaLiveScheduleRoom', name?: string | null, color?: string | null, activities?: Array<{ __typename?: 'WcaLiveScheduleActivity', activityId?: number | null, name?: string | null, activityCode?: string | null, startTime?: string | null, endTime?: string | null, dayIndex?: number | null, dayLabel?: string | null, roundNumber?: number | null, isFinal?: boolean | null, chance?: number | null } | null> | null } | null> | null } | null> | null, records?: Array<{ __typename?: 'WcaLiveRecord', type?: string | null, tag?: string | null, eventId?: string | null, eventName?: string | null, attemptResult?: number | null, personName?: string | null, personCountryIso2?: string | null, roundNumber?: number | null } | null> | null, podiums?: Array<{ __typename?: 'WcaLivePodium', eventId?: string | null, eventName?: string | null, sortBy?: string | null, entries?: Array<{ __typename?: 'WcaLivePodiumEntry', ranking?: number | null, personName?: string | null, personCountryIso2?: string | null, best?: number | null, average?: number | null, singleRecordTag?: string | null, averageRecordTag?: string | null } | null> | null } | null> | null } | null };

export type WcaLiveRoundResultsQueryVariables = Exact<{
  input: WcaLiveRoundInput;
}>;


export type WcaLiveRoundResultsQuery = { __typename?: 'Query', wcaLiveRoundResults?: { __typename?: 'WcaLiveRoundResults', roundActivityCode?: string | null, roundName?: string | null, active?: boolean | null, finished?: boolean | null, numberOfAttempts?: number | null, sortBy?: string | null, dualChance?: boolean | null, results?: Array<{ __typename?: 'WcaLiveResult', ranking?: number | null, best?: number | null, average?: number | null, personName?: string | null, personWcaId?: string | null, personCountryIso2?: string | null, personLiveId?: string | null, singleRecordTag?: string | null, averageRecordTag?: string | null, advancing?: boolean | null, advancingQuestionable?: boolean | null, attempts?: Array<{ __typename?: 'WcaLiveAttempt', result?: number | null } | null> | null, chances?: Array<{ __typename?: 'WcaLiveChance', chance?: number | null, best?: number | null, average?: number | null, noShow?: boolean | null, counting?: boolean | null, attempts?: Array<{ __typename?: 'WcaLiveAttempt', result?: number | null } | null> | null }> | null } | null> | null } | null };

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

export type LandingStatsQueryVariables = Exact<{ [key: string]: never; }>;


export type LandingStatsQuery = { __typename?: 'Query', landingStats?: { __typename?: 'LandingStats', upcoming_wca_competition_count?: number | null, total_competitor_capacity?: number | null, supported_event_count?: number | null, supported_language_count?: number | null, cuber_count?: number | null, solve_count?: number | null } | null };

export type MyCompetitionFollowsQueryVariables = Exact<{
  competitionId: Scalars['String'];
}>;


export type MyCompetitionFollowsQuery = { __typename?: 'Query', myCompetitionFollows?: Array<{ __typename?: 'CompetitionFollow', id?: string | null, competition_id?: string | null, followed_registrant_id?: number | null, followed_wca_id?: string | null, followed_name?: string | null, created_at?: any | null } | null> | null };

export type CaseStatsQueryVariables = Exact<{
  type: Scalars['String'];
  cubeType?: InputMaybe<Scalars['String']>;
  subset?: InputMaybe<Scalars['String']>;
  sessionId?: InputMaybe<Scalars['String']>;
  lastN?: InputMaybe<Scalars['Int']>;
}>;


export type CaseStatsQuery = { __typename?: 'Query', caseStats?: Array<{ __typename?: 'CaseStat', caseKey?: string | null, caseName?: string | null, caseType?: string | null, count?: number | null, averageTime?: number | null, bestTime?: number | null, avgRecognition?: number | null, avgExecution?: number | null, avgTps?: number | null, avgTurns?: number | null, lastSeenAt?: number | null } | null> | null };

export type AdminActiveUsersQueryVariables = Exact<{
  period: Scalars['String'];
  monthYear?: InputMaybe<Scalars['String']>;
}>;


export type AdminActiveUsersQuery = { __typename?: 'Query', adminActiveUsers?: { __typename?: 'AdminActiveUsersResult', total_active_users?: number | null, total_active_minutes?: number | null, available_months?: Array<string | null> | null, rows?: Array<{ __typename?: 'ActiveUserRow', active_minutes?: number | null, last_seen_at?: any | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null } | null> | null } | null };

export type ConversationsQueryVariables = Exact<{
  page?: InputMaybe<Scalars['Int']>;
  requests?: InputMaybe<Scalars['Boolean']>;
}>;


export type ConversationsQuery = { __typename?: 'Query', conversations?: { __typename?: 'ConversationList', more_results?: boolean | null, conversations?: Array<{ __typename?: 'ConversationView', id?: string | null, unread_count?: number | null, accepted?: boolean | null, muted?: boolean | null, last_message_at?: any | null, other_user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, last_message?: { __typename?: 'Message', id?: string | null, conversation_id?: string | null, sender_id?: string | null, body?: string | null, created_at?: any | null, edited_at?: any | null, reactions?: Array<{ __typename?: 'MessageReaction', user_id?: string | null, emoji?: string | null }> | null, reply_to?: { __typename?: 'ReplyPreview', id?: string | null, sender_id?: string | null, body?: string | null, deleted_at?: any | null, solve_id?: string | null, sender?: { __typename?: 'ReplyPreviewSender', username?: string | null } | null } | null, sender?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, solve?: { __typename?: 'Solve', id?: string | null, time?: number | null, dnf?: boolean | null, plus_two?: boolean | null, cube_type?: string | null, scramble_subset?: string | null, scramble?: string | null, share_code?: string | null, is_smart_cube?: boolean | null, is_virtual_cube?: boolean | null, created_at?: any | null } | null } | null } | null> | null } | null };

export type DmMessagesQueryVariables = Exact<{
  conversationId: Scalars['String'];
  before?: InputMaybe<Scalars['DateTime']>;
}>;


export type DmMessagesQuery = { __typename?: 'Query', messages?: { __typename?: 'MessageList', more_results?: boolean | null, accepted?: boolean | null, awaiting_accept?: boolean | null, muted?: boolean | null, messages?: Array<{ __typename?: 'Message', id?: string | null, conversation_id?: string | null, sender_id?: string | null, body?: string | null, created_at?: any | null, edited_at?: any | null, reactions?: Array<{ __typename?: 'MessageReaction', user_id?: string | null, emoji?: string | null }> | null, reply_to?: { __typename?: 'ReplyPreview', id?: string | null, sender_id?: string | null, body?: string | null, deleted_at?: any | null, solve_id?: string | null, sender?: { __typename?: 'ReplyPreviewSender', username?: string | null } | null } | null, sender?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, solve?: { __typename?: 'Solve', id?: string | null, time?: number | null, dnf?: boolean | null, plus_two?: boolean | null, cube_type?: string | null, scramble_subset?: string | null, scramble?: string | null, share_code?: string | null, is_smart_cube?: boolean | null, is_virtual_cube?: boolean | null, created_at?: any | null } | null } | null> | null } | null };

export type DmPresenceQueryVariables = Exact<{
  userIds: Array<Scalars['String']> | Scalars['String'];
}>;


export type DmPresenceQuery = { __typename?: 'Query', dmPresence?: Array<string | null> | null };

export type InboxSummaryQueryVariables = Exact<{ [key: string]: never; }>;


export type InboxSummaryQuery = { __typename?: 'Query', inboxSummary?: { __typename?: 'InboxSummary', unread_total?: number | null, request_count?: number | null } | null };

export type MessageReportsQueryVariables = Exact<{
  status?: InputMaybe<ReportStatus>;
  page?: InputMaybe<Scalars['Int']>;
}>;


export type MessageReportsQuery = { __typename?: 'Query', messageReports?: { __typename?: 'MessageReportList', open_count?: number | null, more_results?: boolean | null, reports?: Array<{ __typename?: 'MessageReportView', id?: string | null, reason?: string | null, status?: ReportStatus | null, moderator_note?: string | null, reviewed_at?: any | null, created_at?: any | null, reporter?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, reported?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, reviewed_by?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null, snapshot?: Array<{ __typename?: 'ReportSnapshotMessage', id?: string | null, sender_id?: string | null, sender_username?: string | null, body?: string | null, has_solve?: boolean | null, created_at?: string | null } | null> | null } | null> | null } | null };

export type SocialPreferenceQueryVariables = Exact<{ [key: string]: never; }>;


export type SocialPreferenceQuery = { __typename?: 'Query', socialPreference?: { __typename?: 'SocialPreference', dm_policy?: DmPolicy | null, read_receipts?: boolean | null, typing_indicator?: boolean | null, online_status?: boolean | null, searchable?: boolean | null, dm_push?: boolean | null } | null };

export type BlockedUsersQueryVariables = Exact<{ [key: string]: never; }>;


export type BlockedUsersQuery = { __typename?: 'Query', blockedUsers?: Array<{ __typename?: 'BlockedUser', id?: string | null, created_at?: any | null, user?: { __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null } | null> | null };

export type MessageRecipientSearchQueryVariables = Exact<{
  query: Scalars['String'];
}>;


export type MessageRecipientSearchQuery = { __typename?: 'Query', messageRecipientSearch?: Array<{ __typename?: 'PublicUserAccount', id?: string | null, username?: string | null, verified?: boolean | null, created_at?: any | null, banned_forever?: boolean | null, is_pro?: boolean | null, is_premium?: boolean | null, banned_until?: any | null, admin?: boolean | null, mod?: boolean | null, integrations?: Array<{ __typename?: 'Integration', id?: string | null, service_name?: IntegrationType | null, wca_country_iso2?: string | null, zkt_country_iso2?: string | null } | null> | null, profile?: { __typename?: 'Profile', pfp_image?: { __typename?: 'Image', id?: string | null, user_id?: string | null, storage_path?: string | null } | null } | null } | null> | null };

export type SmartCubeTelemetrySummaryQueryVariables = Exact<{
  days?: InputMaybe<Scalars['Int']>;
}>;


export type SmartCubeTelemetrySummaryQuery = { __typename?: 'Query', smartCubeTelemetrySummary?: Array<{ __typename?: 'SmartCubeTelemetrySummary', cube_type?: string | null, device_name?: string | null, solves?: number | null, distinct_users?: number | null, via_tracker?: number | null, via_grace?: number | null, via_poll?: number | null, out_of_sync_events?: number | null, late_scramble_events?: number | null, scramble_realign_events?: number | null, scramble_reset_events?: number | null, median_lag_ms?: number | null, p95_lag_ms?: number | null, avg_battery_clean?: number | null, avg_battery_recovered?: number | null, median_time_correction_ms?: number | null, avg_recovered_moves?: number | null } | null> | null };

export type MagnetTelemetrySummaryQueryVariables = Exact<{
  days?: InputMaybe<Scalars['Int']>;
}>;


export type MagnetTelemetrySummaryQuery = { __typename?: 'Query', magnetTelemetrySummary?: Array<{ __typename?: 'MagnetTelemetrySummary', platform?: string | null, device_model?: string | null, cube_puzzle?: string | null, median_near_min_ut?: number | null, sensor_name?: string | null, distinct_users?: number | null, placements?: number | null, min_near_ut?: number | null, median_near_ut?: number | null, lifts?: number | null, started?: number | null, refused?: number | null, median_latency_ms?: number | null, p95_latency_ms?: number | null, median_approach_ms?: number | null, rejects?: number | null, unsupported?: number | null, unknown_hints?: number | null, median_sigma?: number | null, rate_hz?: number | null } | null> | null };

export type MagnetTelemetryRowsQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  username?: InputMaybe<Scalars['String']>;
  eventType?: InputMaybe<Scalars['String']>;
  deviceModel?: InputMaybe<Scalars['String']>;
  newestFirst?: InputMaybe<Scalars['Boolean']>;
}>;


export type MagnetTelemetryRowsQuery = { __typename?: 'Query', magnetTelemetryRows?: Array<{ __typename?: 'MagnetTelemetryRow', id?: string | null, username?: string | null, platform?: string | null, device_model?: string | null, os_version?: string | null, sensor_name?: string | null, event_type?: string | null, detail?: string | null, delta_ut?: number | null, latency_ms?: number | null, rest_ms?: number | null, approach_ms?: number | null, sigma?: number | null, rate_hz?: number | null, reversed?: boolean | null, has_samples?: boolean | null, app_version?: string | null, cube_puzzle?: string | null, near_min_ut?: number | null, created_at?: any | null } | null> | null };

export type MagnetTelemetrySamplesQueryVariables = Exact<{
  id: Scalars['String'];
}>;


export type MagnetTelemetrySamplesQuery = { __typename?: 'Query', magnetTelemetrySamples?: string | null };

export type SmartCubeTelemetryRowsQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']>;
  cubeType?: InputMaybe<Scalars['String']>;
  offset?: InputMaybe<Scalars['Int']>;
  username?: InputMaybe<Scalars['String']>;
  eventType?: InputMaybe<Scalars['String']>;
  newestFirst?: InputMaybe<Scalars['Boolean']>;
}>;


export type SmartCubeTelemetryRowsQuery = { __typename?: 'Query', smartCubeTelemetryRows?: Array<{ __typename?: 'SmartCubeTelemetryRow', id?: string | null, username?: string | null, device_name?: string | null, cube_type?: string | null, surface?: string | null, event_type?: string | null, detection_source?: string | null, detection_lag_ms?: number | null, time_ms?: number | null, turn_count?: number | null, battery_level?: number | null, time_correction_ms?: number | null, recovered_moves?: number | null, is_native?: boolean | null, app_version?: string | null, created_at?: any | null } | null> | null };

export type ZktPersonBestsQueryVariables = Exact<{
  zktId: Scalars['String'];
}>;


export type ZktPersonBestsQuery = { __typename?: 'Query', zktPersonBests?: Array<{ __typename?: 'ZktEventPb', event_id?: string | null, single?: string | null, average?: string | null }> | null };

export type RegistrationWatchAccessQueryVariables = Exact<{ [key: string]: never; }>;


export type RegistrationWatchAccessQuery = { __typename?: 'Query', registrationWatchAccess?: boolean | null };

export type RegistrationWatchCompetitionFragmentFragment = { __typename?: 'RegistrationWatchCompetitionRow', competition_id?: string | null, name?: string | null, start_date?: string | null, end_date?: string | null, registration_close?: any | null, competitor_limit?: number | null, accepted_count?: number | null, event_count?: number | null, flagged_count?: number | null, last_event_at?: any | null, baseline_at?: any | null, confirmed_at?: any | null, groups_seen_at?: any | null };

export type RegistrationWatchCompetitionsQueryVariables = Exact<{ [key: string]: never; }>;


export type RegistrationWatchCompetitionsQuery = { __typename?: 'Query', registrationWatchCompetitions?: Array<{ __typename?: 'RegistrationWatchCompetitionRow', competition_id?: string | null, name?: string | null, start_date?: string | null, end_date?: string | null, registration_close?: any | null, competitor_limit?: number | null, accepted_count?: number | null, event_count?: number | null, flagged_count?: number | null, last_event_at?: any | null, baseline_at?: any | null, confirmed_at?: any | null, groups_seen_at?: any | null } | null> | null };

export type RegistrationWatchCompetitionQueryVariables = Exact<{
  competitionId: Scalars['String'];
}>;


export type RegistrationWatchCompetitionQuery = { __typename?: 'Query', registrationWatchCompetition?: { __typename?: 'RegistrationWatchDetail', competition?: { __typename?: 'RegistrationWatchCompetitionRow', competition_id?: string | null, name?: string | null, start_date?: string | null, end_date?: string | null, registration_close?: any | null, competitor_limit?: number | null, accepted_count?: number | null, event_count?: number | null, flagged_count?: number | null, last_event_at?: any | null, baseline_at?: any | null, confirmed_at?: any | null, groups_seen_at?: any | null } | null, events?: Array<{ __typename?: 'RegistrationWatchEventRow', id?: string | null, kind?: string | null, wca_registration_id?: number | null, registrant_id?: number | null, wca_id?: string | null, name?: string | null, events_before?: Array<string | null> | null, events_after?: Array<string | null> | null, after_close?: boolean | null, after_groups?: boolean | null, window_start?: any | null, observed_at?: any | null } | null> | null, registrants?: Array<{ __typename?: 'RegistrationWatchRegistrantRow', wca_registration_id?: number | null, registrant_id?: number | null, wca_id?: string | null, name?: string | null, event_ids?: Array<string | null> | null, competitor_groups?: number | null, staff_tasks?: number | null, unstaffed?: boolean | null, first_seen_at?: any | null } | null> | null } | null };

export const AlgSetItemFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AlgSetItemFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AlgSetItem"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"case_name"}},{"kind":"Field","name":{"kind":"Name","value":"subset"}},{"kind":"Field","name":{"kind":"Name","value":"puzzle"}},{"kind":"Field","name":{"kind":"Name","value":"algorithm"}},{"kind":"Field","name":{"kind":"Name","value":"position"}}]}}]} as unknown as DocumentNode<AlgSetItemFragmentFragment, unknown>;
export const AlgSetOwnerFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AlgSetOwnerFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AlgSetOwner"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"verified"}},{"kind":"Field","name":{"kind":"Name","value":"avatar_path"}}]}}]} as unknown as DocumentNode<AlgSetOwnerFragmentFragment, unknown>;
export const AlgSetSummaryFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AlgSetSummaryFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AlgSetSummary"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"visibility"}},{"kind":"Field","name":{"kind":"Name","value":"item_count"}},{"kind":"Field","name":{"kind":"Name","value":"save_count"}},{"kind":"Field","name":{"kind":"Name","value":"categories"}},{"kind":"Field","name":{"kind":"Name","value":"puzzles"}},{"kind":"Field","name":{"kind":"Name","value":"preview"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AlgSetItemFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"owner"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AlgSetOwnerFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"published_at"}},{"kind":"Field","name":{"kind":"Name","value":"updated_at"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"hidden"}}]}}]} as unknown as DocumentNode<AlgSetSummaryFragmentFragment, unknown>;
export const AlgSetHeadFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AlgSetHeadFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AlgSet"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"visibility"}},{"kind":"Field","name":{"kind":"Name","value":"item_count"}},{"kind":"Field","name":{"kind":"Name","value":"save_count"}},{"kind":"Field","name":{"kind":"Name","value":"categories"}},{"kind":"Field","name":{"kind":"Name","value":"puzzles"}},{"kind":"Field","name":{"kind":"Name","value":"preview"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AlgSetItemFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"owner"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AlgSetOwnerFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"published_at"}},{"kind":"Field","name":{"kind":"Name","value":"updated_at"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"hidden"}},{"kind":"Field","name":{"kind":"Name","value":"is_owner"}},{"kind":"Field","name":{"kind":"Name","value":"is_saved"}}]}}]} as unknown as DocumentNode<AlgSetHeadFragmentFragment, unknown>;
export const AlgSetFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AlgSetFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AlgSet"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AlgSetHeadFragment"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AlgSetItemFragment"}}]}}]}}]} as unknown as DocumentNode<AlgSetFragmentFragment, unknown>;
export const BattlePlayerFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BattlePlayerFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BattlePlayer"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"pfp_image_url"}}]}}]} as unknown as DocumentNode<BattlePlayerFragmentFragment, unknown>;
export const BattleLeaderboardRowFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BattleLeaderboardRowFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BattleLeaderboardRow"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rank"}},{"kind":"Field","name":{"kind":"Name","value":"user_id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"pfp_image_url"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"provisional"}},{"kind":"Field","name":{"kind":"Name","value":"games"}},{"kind":"Field","name":{"kind":"Name","value":"wins"}},{"kind":"Field","name":{"kind":"Name","value":"losses"}},{"kind":"Field","name":{"kind":"Name","value":"draws"}}]}}]} as unknown as DocumentNode<BattleLeaderboardRowFragmentFragment, unknown>;
export const CubeCalibrationFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"CubeCalibrationFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"CubeCalibration"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"cube_id"}},{"kind":"Field","name":{"kind":"Name","value":"platform"}},{"kind":"Field","name":{"kind":"Name","value":"device_model"}},{"kind":"Field","name":{"kind":"Name","value":"os_version"}},{"kind":"Field","name":{"kind":"Name","value":"app_version"}},{"kind":"Field","name":{"kind":"Name","value":"sensor_name"}},{"kind":"Field","name":{"kind":"Name","value":"peak_ut"}},{"kind":"Field","name":{"kind":"Name","value":"rest_ut"}},{"kind":"Field","name":{"kind":"Name","value":"noise_ut"}},{"kind":"Field","name":{"kind":"Name","value":"near_min_ut"}},{"kind":"Field","name":{"kind":"Name","value":"far_max_ut"}},{"kind":"Field","name":{"kind":"Name","value":"quality"}},{"kind":"Field","name":{"kind":"Name","value":"sample_count"}},{"kind":"Field","name":{"kind":"Name","value":"sweep_ms"}},{"kind":"Field","name":{"kind":"Name","value":"rate_hz"}},{"kind":"Field","name":{"kind":"Name","value":"algo_version"}},{"kind":"Field","name":{"kind":"Name","value":"measured_at"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"updated_at"}}]}}]} as unknown as DocumentNode<CubeCalibrationFragmentFragment, unknown>;
export const CubeFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"CubeFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Cube"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"puzzle"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"brand"}},{"kind":"Field","name":{"kind":"Name","value":"is_smart"}},{"kind":"Field","name":{"kind":"Name","value":"ble_device_id"}},{"kind":"Field","name":{"kind":"Name","value":"ble_name"}},{"kind":"Field","name":{"kind":"Name","value":"legacy_smart_device_ids"}},{"kind":"Field","name":{"kind":"Name","value":"archived_at"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"updated_at"}},{"kind":"Field","name":{"kind":"Name","value":"solve_count"}},{"kind":"Field","name":{"kind":"Name","value":"first_used_at"}},{"kind":"Field","name":{"kind":"Name","value":"last_used_at"}},{"kind":"Field","name":{"kind":"Name","value":"calibrations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"CubeCalibrationFragment"}}]}}]}}]} as unknown as DocumentNode<CubeFragmentFragment, unknown>;
export const CubeMainFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"CubeMainFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"CubeMain"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"puzzle"}},{"kind":"Field","name":{"kind":"Name","value":"cube_id"}},{"kind":"Field","name":{"kind":"Name","value":"set_at"}}]}}]} as unknown as DocumentNode<CubeMainFragmentFragment, unknown>;
export const MiniSolveFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MiniSolveFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Solve"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"raw_time"}},{"kind":"Field","name":{"kind":"Name","value":"cube_type"}},{"kind":"Field","name":{"kind":"Name","value":"scramble_subset"}},{"kind":"Field","name":{"kind":"Name","value":"session_id"}},{"kind":"Field","name":{"kind":"Name","value":"trainer_name"}},{"kind":"Field","name":{"kind":"Name","value":"bulk"}},{"kind":"Field","name":{"kind":"Name","value":"scramble"}},{"kind":"Field","name":{"kind":"Name","value":"from_timer"}},{"kind":"Field","name":{"kind":"Name","value":"training_session_id"}},{"kind":"Field","name":{"kind":"Name","value":"dnf"}},{"kind":"Field","name":{"kind":"Name","value":"plus_two"}},{"kind":"Field","name":{"kind":"Name","value":"is_smart_cube"}},{"kind":"Field","name":{"kind":"Name","value":"is_virtual_cube"}},{"kind":"Field","name":{"kind":"Name","value":"cube_id"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"started_at"}},{"kind":"Field","name":{"kind":"Name","value":"ended_at"}}]}}]} as unknown as DocumentNode<MiniSolveFragmentFragment, unknown>;
export const StatsFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"StatsFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Stats"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"profile_views"}},{"kind":"Field","name":{"kind":"Name","value":"solve_views"}}]}}]} as unknown as DocumentNode<StatsFragmentFragment, unknown>;
export const StatsModuleBlockFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"StatsModuleBlockFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"StatsModuleBlock"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"statType"}},{"kind":"Field","name":{"kind":"Name","value":"sortBy"}},{"kind":"Field","name":{"kind":"Name","value":"session"}},{"kind":"Field","name":{"kind":"Name","value":"colorName"}},{"kind":"Field","name":{"kind":"Name","value":"averageCount"}}]}}]} as unknown as DocumentNode<StatsModuleBlockFragmentFragment, unknown>;
export const AlgorithmOverrideFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AlgorithmOverrideFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AlgorithmOverride"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cube_key"}},{"kind":"Field","name":{"kind":"Name","value":"rotate"}},{"kind":"Field","name":{"kind":"Name","value":"solution"}}]}}]} as unknown as DocumentNode<AlgorithmOverrideFragmentFragment, unknown>;
export const TrainerFavoriteFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TrainerFavoriteFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TrainerFavorite"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cube_key"}}]}}]} as unknown as DocumentNode<TrainerFavoriteFragmentFragment, unknown>;
export const TrainerAlgorithmFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TrainerAlgorithmFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TrainerAlgorithm"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"scrambles"}},{"kind":"Field","name":{"kind":"Name","value":"solution"}},{"kind":"Field","name":{"kind":"Name","value":"pro_only"}},{"kind":"Field","name":{"kind":"Name","value":"cube_type"}},{"kind":"Field","name":{"kind":"Name","value":"algo_type"}},{"kind":"Field","name":{"kind":"Name","value":"colors"}},{"kind":"Field","name":{"kind":"Name","value":"group_name"}}]}}]} as unknown as DocumentNode<TrainerAlgorithmFragmentFragment, unknown>;
export const SessionFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SessionFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Session"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"order"}}]}}]} as unknown as DocumentNode<SessionFragmentFragment, unknown>;
export const ImageFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ImageFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Image"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"user_id"}},{"kind":"Field","name":{"kind":"Name","value":"storage_path"}}]}}]} as unknown as DocumentNode<ImageFragmentFragment, unknown>;
export const PublicUserFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PublicUserFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"IPublicUserAccount"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"verified"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"banned_forever"}},{"kind":"Field","name":{"kind":"Name","value":"is_pro"}},{"kind":"Field","name":{"kind":"Name","value":"is_premium"}},{"kind":"Field","name":{"kind":"Name","value":"banned_until"}},{"kind":"Field","name":{"kind":"Name","value":"admin"}},{"kind":"Field","name":{"kind":"Name","value":"mod"}},{"kind":"Field","name":{"kind":"Name","value":"integrations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"service_name"}},{"kind":"Field","name":{"kind":"Name","value":"wca_country_iso2"}},{"kind":"Field","name":{"kind":"Name","value":"zkt_country_iso2"}}]}},{"kind":"Field","name":{"kind":"Name","value":"profile"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pfp_image"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ImageFragment"}}]}}]}}]}}]} as unknown as DocumentNode<PublicUserFragmentFragment, unknown>;
export const UserAccountFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UserAccountFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"IUserAccount"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserFragment"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"pending_email"}},{"kind":"Field","name":{"kind":"Name","value":"email_verified"}},{"kind":"Field","name":{"kind":"Name","value":"offline_hash"}}]}}]} as unknown as DocumentNode<UserAccountFragmentFragment, unknown>;
export const SolveFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SolveFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Solve"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"raw_time"}},{"kind":"Field","name":{"kind":"Name","value":"cube_type"}},{"kind":"Field","name":{"kind":"Name","value":"scramble_subset"}},{"kind":"Field","name":{"kind":"Name","value":"user_id"}},{"kind":"Field","name":{"kind":"Name","value":"scramble"}},{"kind":"Field","name":{"kind":"Name","value":"session_id"}},{"kind":"Field","name":{"kind":"Name","value":"started_at"}},{"kind":"Field","name":{"kind":"Name","value":"ended_at"}},{"kind":"Field","name":{"kind":"Name","value":"dnf"}},{"kind":"Field","name":{"kind":"Name","value":"plus_two"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"is_smart_cube"}},{"kind":"Field","name":{"kind":"Name","value":"is_virtual_cube"}},{"kind":"Field","name":{"kind":"Name","value":"smart_turn_count"}},{"kind":"Field","name":{"kind":"Name","value":"share_code"}},{"kind":"Field","name":{"kind":"Name","value":"smart_turns"}},{"kind":"Field","name":{"kind":"Name","value":"smart_rotations"}},{"kind":"Field","name":{"kind":"Name","value":"smart_put_down_time"}},{"kind":"Field","name":{"kind":"Name","value":"inspection_time"}},{"kind":"Field","name":{"kind":"Name","value":"phase_splits"}},{"kind":"Field","name":{"kind":"Name","value":"cube_id"}},{"kind":"Field","name":{"kind":"Name","value":"solve_method_steps"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"turn_count"}},{"kind":"Field","name":{"kind":"Name","value":"turns"}},{"kind":"Field","name":{"kind":"Name","value":"total_time"}},{"kind":"Field","name":{"kind":"Name","value":"tps"}},{"kind":"Field","name":{"kind":"Name","value":"recognition_time"}},{"kind":"Field","name":{"kind":"Name","value":"oll_case_key"}},{"kind":"Field","name":{"kind":"Name","value":"pll_case_key"}},{"kind":"Field","name":{"kind":"Name","value":"case_key"}},{"kind":"Field","name":{"kind":"Name","value":"case_set"}},{"kind":"Field","name":{"kind":"Name","value":"skipped"}},{"kind":"Field","name":{"kind":"Name","value":"parent_name"}},{"kind":"Field","name":{"kind":"Name","value":"method_name"}},{"kind":"Field","name":{"kind":"Name","value":"step_index"}},{"kind":"Field","name":{"kind":"Name","value":"step_name"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}}]}}]} as unknown as DocumentNode<SolveFragmentFragment, unknown>;
export const SolveWithUserFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SolveWithUserFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Solve"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SolveFragment"}},{"kind":"Field","name":{"kind":"Name","value":"cube"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"brand"}},{"kind":"Field","name":{"kind":"Name","value":"puzzle"}},{"kind":"Field","name":{"kind":"Name","value":"is_smart"}}]}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserFragment"}}]}}]}}]} as unknown as DocumentNode<SolveWithUserFragmentFragment, unknown>;
export const NotificationFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"NotificationFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Notification"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"user_id"}},{"kind":"Field","name":{"kind":"Name","value":"notification_type"}},{"kind":"Field","name":{"kind":"Name","value":"notification_category_name"}},{"kind":"Field","name":{"kind":"Name","value":"triggering_user_id"}},{"kind":"Field","name":{"kind":"Name","value":"in_app_message"}},{"kind":"Field","name":{"kind":"Name","value":"read_at"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"icon"}},{"kind":"Field","name":{"kind":"Name","value":"link"}},{"kind":"Field","name":{"kind":"Name","value":"link_text"}},{"kind":"Field","name":{"kind":"Name","value":"subject"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"triggering_user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserFragment"}}]}}]}}]} as unknown as DocumentNode<NotificationFragmentFragment, unknown>;
export const TopSolveFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TopSolveFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TopSolve"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"cube_type"}},{"kind":"Field","name":{"kind":"Name","value":"scramble_subset"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"solve"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SolveFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserFragment"}}]}}]}}]} as unknown as DocumentNode<TopSolveFragmentFragment, unknown>;
export const TopAverageFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TopAverageFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TopAverage"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"cube_type"}},{"kind":"Field","name":{"kind":"Name","value":"scramble_subset"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"solve_1"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SolveFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solve_2"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SolveFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solve_3"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SolveFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solve_4"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SolveFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solve_5"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SolveFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserFragment"}}]}}]}}]} as unknown as DocumentNode<TopAverageFragmentFragment, unknown>;
export const ProfileFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ProfileFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Profile"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}},{"kind":"Field","name":{"kind":"Name","value":"three_method"}},{"kind":"Field","name":{"kind":"Name","value":"three_goal"}},{"kind":"Field","name":{"kind":"Name","value":"main_three_cube"}},{"kind":"Field","name":{"kind":"Name","value":"favorite_event"}},{"kind":"Field","name":{"kind":"Name","value":"youtube_link"}},{"kind":"Field","name":{"kind":"Name","value":"twitter_link"}},{"kind":"Field","name":{"kind":"Name","value":"user_id"}},{"kind":"Field","name":{"kind":"Name","value":"reddit_link"}},{"kind":"Field","name":{"kind":"Name","value":"twitch_link"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"top_solves"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"TopSolveFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"top_averages"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"TopAverageFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"header_image"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ImageFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pfp_image"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ImageFragment"}}]}}]}}]} as unknown as DocumentNode<ProfileFragmentFragment, unknown>;
export const IntegrationFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"IntegrationFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Integration"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"auth_expires_at"}},{"kind":"Field","name":{"kind":"Name","value":"service_name"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}}]} as unknown as DocumentNode<IntegrationFragmentFragment, unknown>;
export const CustomTrainerFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"CustomTrainerFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"CustomTrainer"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"solution"}},{"kind":"Field","name":{"kind":"Name","value":"scrambles"}},{"kind":"Field","name":{"kind":"Name","value":"colors"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"alt_solutions"}},{"kind":"Field","name":{"kind":"Name","value":"group_name"}},{"kind":"Field","name":{"kind":"Name","value":"algo_type"}},{"kind":"Field","name":{"kind":"Name","value":"three_d"}},{"kind":"Field","name":{"kind":"Name","value":"cube_type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"copy_of_id"}},{"kind":"Field","name":{"kind":"Name","value":"copy_of"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}}]}}]}}]}}]} as unknown as DocumentNode<CustomTrainerFragmentFragment, unknown>;
export const PublicCustomTrainerRecordFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PublicCustomTrainerRecordFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"CustomTrainer"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"CustomTrainerFragment"}},{"kind":"Field","name":{"kind":"Name","value":"user_id"}},{"kind":"Field","name":{"kind":"Name","value":"like_count"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"profile"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pfp_image"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ImageFragment"}}]}}]}}]}}]}}]} as unknown as DocumentNode<PublicCustomTrainerRecordFragmentFragment, unknown>;
export const TimerBackgroundFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TimerBackgroundFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TimerBackground"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"hex"}},{"kind":"Field","name":{"kind":"Name","value":"storage_path"}},{"kind":"Field","name":{"kind":"Name","value":"media_type"}},{"kind":"Field","name":{"kind":"Name","value":"mobile_storage_path"}},{"kind":"Field","name":{"kind":"Name","value":"mobile_media_type"}},{"kind":"Field","name":{"kind":"Name","value":"mobile_same_as_desktop"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"url"}}]}}]} as unknown as DocumentNode<TimerBackgroundFragmentFragment, unknown>;
export const UserForMeFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UserForMeFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"IUserAccount"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"first_name"}},{"kind":"Field","name":{"kind":"Name","value":"last_name"}},{"kind":"Field","name":{"kind":"Name","value":"pending_email"}},{"kind":"Field","name":{"kind":"Name","value":"email_verified"}},{"kind":"Field","name":{"kind":"Name","value":"has_password"}},{"kind":"Field","name":{"kind":"Name","value":"join_country"}},{"kind":"Field","name":{"kind":"Name","value":"timer_background"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"TimerBackgroundFragment"}}]}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserFragment"}}]}}]} as unknown as DocumentNode<UserForMeFragmentFragment, unknown>;
export const ReportFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ReportFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Report"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"reported_user_id"}},{"kind":"Field","name":{"kind":"Name","value":"created_by_id"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"resolved_at"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"created_by"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"reported_user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"alg_set_id"}},{"kind":"Field","name":{"kind":"Name","value":"alg_set"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"visibility"}},{"kind":"Field","name":{"kind":"Name","value":"hidden"}},{"kind":"Field","name":{"kind":"Name","value":"hidden_reason"}}]}}]}}]} as unknown as DocumentNode<ReportFragmentFragment, unknown>;
export const CustomCubeTypeFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"CustomCubeTypeFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"CustomCubeType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"user_id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"scramble"}},{"kind":"Field","name":{"kind":"Name","value":"private"}}]}}]} as unknown as DocumentNode<CustomCubeTypeFragmentFragment, unknown>;
export const SettingsFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SettingsFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Setting"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"user_id"}},{"kind":"Field","name":{"kind":"Name","value":"focus_mode"}},{"kind":"Field","name":{"kind":"Name","value":"freeze_time"}},{"kind":"Field","name":{"kind":"Name","value":"inspection"}},{"kind":"Field","name":{"kind":"Name","value":"manual_entry"}},{"kind":"Field","name":{"kind":"Name","value":"inspection_delay"}},{"kind":"Field","name":{"kind":"Name","value":"session_id"}},{"kind":"Field","name":{"kind":"Name","value":"inverse_time_list"}},{"kind":"Field","name":{"kind":"Name","value":"hide_time_when_solving"}},{"kind":"Field","name":{"kind":"Name","value":"nav_collapsed"}},{"kind":"Field","name":{"kind":"Name","value":"timer_decimal_points"}},{"kind":"Field","name":{"kind":"Name","value":"pb_confetti"}},{"kind":"Field","name":{"kind":"Name","value":"play_inspection_sound"}},{"kind":"Field","name":{"kind":"Name","value":"zero_out_time_after_solve"}},{"kind":"Field","name":{"kind":"Name","value":"confirm_delete_solve"}},{"kind":"Field","name":{"kind":"Name","value":"use_space_with_smart_cube"}},{"kind":"Field","name":{"kind":"Name","value":"use_2d_scramble_visual"}},{"kind":"Field","name":{"kind":"Name","value":"require_period_in_manual_time_entry"}},{"kind":"Field","name":{"kind":"Name","value":"cube_type"}},{"kind":"Field","name":{"kind":"Name","value":"scramble_subset"}},{"kind":"Field","name":{"kind":"Name","value":"scramble_top_color"}},{"kind":"Field","name":{"kind":"Name","value":"custom_cube_types"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"CustomCubeTypeFragment"}}]}}]}}]} as unknown as DocumentNode<SettingsFragmentFragment, unknown>;
export const NotificationPreferenceFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"NotificationPreferenceFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NotificationPreference"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"marketing_emails"}},{"kind":"Field","name":{"kind":"Name","value":"support_ticket_reply"}},{"kind":"Field","name":{"kind":"Name","value":"zkt_competition_announced"}},{"kind":"Field","name":{"kind":"Name","value":"competition_groups_published"}},{"kind":"Field","name":{"kind":"Name","value":"competition_schedule_changed"}},{"kind":"Field","name":{"kind":"Name","value":"competition_results_official"}},{"kind":"Field","name":{"kind":"Name","value":"battle_challenge"}}]}}]} as unknown as DocumentNode<NotificationPreferenceFragmentFragment, unknown>;
export const UserAccountSolvesSummaryFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UserAccountSolvesSummaryFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"UserAccountSolvesSummary"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"count"}},{"kind":"Field","name":{"kind":"Name","value":"average"}},{"kind":"Field","name":{"kind":"Name","value":"min_time"}},{"kind":"Field","name":{"kind":"Name","value":"max_time"}},{"kind":"Field","name":{"kind":"Name","value":"sum"}},{"kind":"Field","name":{"kind":"Name","value":"cube_type"}},{"kind":"Field","name":{"kind":"Name","value":"scramble_subset"}}]}}]} as unknown as DocumentNode<UserAccountSolvesSummaryFragmentFragment, unknown>;
export const UserAccountSummaryFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UserAccountSummaryFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"UserAccountSummary"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"solves"}},{"kind":"Field","name":{"kind":"Name","value":"reports_for"}},{"kind":"Field","name":{"kind":"Name","value":"reports_created"}},{"kind":"Field","name":{"kind":"Name","value":"profile_views"}},{"kind":"Field","name":{"kind":"Name","value":"bans"}},{"kind":"Field","name":{"kind":"Name","value":"timer_solves"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"UserAccountSolvesSummaryFragment"}}]}}]}}]} as unknown as DocumentNode<UserAccountSummaryFragmentFragment, unknown>;
export const UserForAdminFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UserForAdminFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"UserAccountForAdmin"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserFragment"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"join_country"}},{"kind":"Field","name":{"kind":"Name","value":"join_ip"}},{"kind":"Field","name":{"kind":"Name","value":"reports_for"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ReportFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"settings"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SettingsFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"notification_preferences"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"NotificationPreferenceFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"summary"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"UserAccountSummaryFragment"}}]}}]}}]} as unknown as DocumentNode<UserForAdminFragmentFragment, unknown>;
export const ReportSummaryFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ReportSummaryFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ReportSummary"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"last_report"}},{"kind":"Field","name":{"kind":"Name","value":"first_report"}},{"kind":"Field","name":{"kind":"Name","value":"count"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"reports"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ReportFragment"}}]}}]}}]} as unknown as DocumentNode<ReportSummaryFragmentFragment, unknown>;
export const DmSolveFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DmSolveFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Solve"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"dnf"}},{"kind":"Field","name":{"kind":"Name","value":"plus_two"}},{"kind":"Field","name":{"kind":"Name","value":"cube_type"}},{"kind":"Field","name":{"kind":"Name","value":"scramble_subset"}},{"kind":"Field","name":{"kind":"Name","value":"scramble"}},{"kind":"Field","name":{"kind":"Name","value":"share_code"}},{"kind":"Field","name":{"kind":"Name","value":"is_smart_cube"}},{"kind":"Field","name":{"kind":"Name","value":"is_virtual_cube"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}}]} as unknown as DocumentNode<DmSolveFragmentFragment, unknown>;
export const MessageFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MessageFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Message"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"conversation_id"}},{"kind":"Field","name":{"kind":"Name","value":"sender_id"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"edited_at"}},{"kind":"Field","name":{"kind":"Name","value":"reactions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"user_id"}},{"kind":"Field","name":{"kind":"Name","value":"emoji"}}]}},{"kind":"Field","name":{"kind":"Name","value":"reply_to"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"sender_id"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"deleted_at"}},{"kind":"Field","name":{"kind":"Name","value":"solve_id"}},{"kind":"Field","name":{"kind":"Name","value":"sender"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"username"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"sender"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solve"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DmSolveFragment"}}]}}]}}]} as unknown as DocumentNode<MessageFragmentFragment, unknown>;
export const ConversationViewFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ConversationViewFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ConversationView"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"unread_count"}},{"kind":"Field","name":{"kind":"Name","value":"accepted"}},{"kind":"Field","name":{"kind":"Name","value":"muted"}},{"kind":"Field","name":{"kind":"Name","value":"last_message_at"}},{"kind":"Field","name":{"kind":"Name","value":"other_user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"last_message"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MessageFragment"}}]}}]}}]} as unknown as DocumentNode<ConversationViewFragmentFragment, unknown>;
export const RegistrationWatchCompetitionFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"RegistrationWatchCompetitionFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"RegistrationWatchCompetitionRow"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"competition_id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"start_date"}},{"kind":"Field","name":{"kind":"Name","value":"end_date"}},{"kind":"Field","name":{"kind":"Name","value":"registration_close"}},{"kind":"Field","name":{"kind":"Name","value":"competitor_limit"}},{"kind":"Field","name":{"kind":"Name","value":"accepted_count"}},{"kind":"Field","name":{"kind":"Name","value":"event_count"}},{"kind":"Field","name":{"kind":"Name","value":"flagged_count"}},{"kind":"Field","name":{"kind":"Name","value":"last_event_at"}},{"kind":"Field","name":{"kind":"Name","value":"baseline_at"}},{"kind":"Field","name":{"kind":"Name","value":"confirmed_at"}},{"kind":"Field","name":{"kind":"Name","value":"groups_seen_at"}}]}}]} as unknown as DocumentNode<RegistrationWatchCompetitionFragmentFragment, unknown>;
export const AdminProUsersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AdminProUsers"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pageArgs"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"PaginationArgsInput"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"search"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"adminUserSearch"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"pageArgs"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pageArgs"}}},{"kind":"Argument","name":{"kind":"Name","value":"filters"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"is_pro"},"value":{"kind":"BooleanValue","value":true}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasMore"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"is_pro"}},{"kind":"Field","name":{"kind":"Name","value":"pro_expires_at"}},{"kind":"Field","name":{"kind":"Name","value":"iap_platform"}},{"kind":"Field","name":{"kind":"Name","value":"iap_product_id"}},{"kind":"Field","name":{"kind":"Name","value":"iap_cancellation_at"}},{"kind":"Field","name":{"kind":"Name","value":"iap_billing_issue_at"}},{"kind":"Field","name":{"kind":"Name","value":"iap_paused_until"}},{"kind":"Field","name":{"kind":"Name","value":"revenuecat_user_id"}},{"kind":"Field","name":{"kind":"Name","value":"profile"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pfp_image"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"storage_path"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<AdminProUsersQuery, AdminProUsersQueryVariables>;
export const MyAlgSetsDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MyAlgSets"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"myAlgSets"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"own"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AlgSetSummaryFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"saved"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"set_id"}},{"kind":"Field","name":{"kind":"Name","value":"saved_at"}},{"kind":"Field","name":{"kind":"Name","value":"unavailable"}},{"kind":"Field","name":{"kind":"Name","value":"set"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AlgSetSummaryFragment"}}]}}]}}]}}]}},...AlgSetSummaryFragmentFragmentDoc.definitions,...AlgSetItemFragmentFragmentDoc.definitions,...AlgSetOwnerFragmentFragmentDoc.definitions]} as unknown as DocumentNode<MyAlgSetsQuery, MyAlgSetsQueryVariables>;
export const AlgSetDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AlgSet"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"code"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"algSet"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"code"},"value":{"kind":"Variable","name":{"kind":"Name","value":"code"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AlgSetFragment"}}]}}]}},...AlgSetFragmentFragmentDoc.definitions,...AlgSetHeadFragmentFragmentDoc.definitions,...AlgSetItemFragmentFragmentDoc.definitions,...AlgSetOwnerFragmentFragmentDoc.definitions]} as unknown as DocumentNode<AlgSetQuery, AlgSetQueryVariables>;
export const AlgSetMetaDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AlgSetMeta"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"code"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"algSet"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"code"},"value":{"kind":"Variable","name":{"kind":"Name","value":"code"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AlgSetHeadFragment"}}]}}]}},...AlgSetHeadFragmentFragmentDoc.definitions,...AlgSetItemFragmentFragmentDoc.definitions,...AlgSetOwnerFragmentFragmentDoc.definitions]} as unknown as DocumentNode<AlgSetMetaQuery, AlgSetMetaQueryVariables>;
export const CommunityAlgSetsDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"CommunityAlgSets"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"q"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sort"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"puzzle"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"category"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"page"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"page_size"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"communityAlgSets"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"q"},"value":{"kind":"Variable","name":{"kind":"Name","value":"q"}}},{"kind":"Argument","name":{"kind":"Name","value":"sort"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sort"}}},{"kind":"Argument","name":{"kind":"Name","value":"puzzle"},"value":{"kind":"Variable","name":{"kind":"Name","value":"puzzle"}}},{"kind":"Argument","name":{"kind":"Name","value":"category"},"value":{"kind":"Variable","name":{"kind":"Name","value":"category"}}},{"kind":"Argument","name":{"kind":"Name","value":"page"},"value":{"kind":"Variable","name":{"kind":"Name","value":"page"}}},{"kind":"Argument","name":{"kind":"Name","value":"page_size"},"value":{"kind":"Variable","name":{"kind":"Name","value":"page_size"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AlgSetSummaryFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"has_more"}}]}}]}},...AlgSetSummaryFragmentFragmentDoc.definitions,...AlgSetItemFragmentFragmentDoc.definitions,...AlgSetOwnerFragmentFragmentDoc.definitions]} as unknown as DocumentNode<CommunityAlgSetsQuery, CommunityAlgSetsQueryVariables>;
export const CreateAlgSetDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateAlgSet"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AlgSetCreateInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createAlgSet"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AlgSetFragment"}}]}}]}},...AlgSetFragmentFragmentDoc.definitions,...AlgSetHeadFragmentFragmentDoc.definitions,...AlgSetItemFragmentFragmentDoc.definitions,...AlgSetOwnerFragmentFragmentDoc.definitions]} as unknown as DocumentNode<CreateAlgSetMutation, CreateAlgSetMutationVariables>;
export const UpdateAlgSetDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateAlgSet"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AlgSetUpdateInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateAlgSet"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AlgSetHeadFragment"}}]}}]}},...AlgSetHeadFragmentFragmentDoc.definitions,...AlgSetItemFragmentFragmentDoc.definitions,...AlgSetOwnerFragmentFragmentDoc.definitions]} as unknown as DocumentNode<UpdateAlgSetMutation, UpdateAlgSetMutationVariables>;
export const DeleteAlgSetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteAlgSet"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteAlgSet"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<DeleteAlgSetMutation, DeleteAlgSetMutationVariables>;
export const ResetAlgSetCodeDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ResetAlgSetCode"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"resetAlgSetCode"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AlgSetHeadFragment"}}]}}]}},...AlgSetHeadFragmentFragmentDoc.definitions,...AlgSetItemFragmentFragmentDoc.definitions,...AlgSetOwnerFragmentFragmentDoc.definitions]} as unknown as DocumentNode<ResetAlgSetCodeMutation, ResetAlgSetCodeMutationVariables>;
export const AddAlgSetItemsDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddAlgSetItems"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"set_id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"items"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AlgSetItemInput"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addAlgSetItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"set_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"set_id"}}},{"kind":"Argument","name":{"kind":"Name","value":"items"},"value":{"kind":"Variable","name":{"kind":"Name","value":"items"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AlgSetFragment"}}]}}]}},...AlgSetFragmentFragmentDoc.definitions,...AlgSetHeadFragmentFragmentDoc.definitions,...AlgSetItemFragmentFragmentDoc.definitions,...AlgSetOwnerFragmentFragmentDoc.definitions]} as unknown as DocumentNode<AddAlgSetItemsMutation, AddAlgSetItemsMutationVariables>;
export const UpdateAlgSetItemDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateAlgSetItem"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"item_id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"algorithm"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateAlgSetItem"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"item_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"item_id"}}},{"kind":"Argument","name":{"kind":"Name","value":"algorithm"},"value":{"kind":"Variable","name":{"kind":"Name","value":"algorithm"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AlgSetItemFragment"}}]}}]}},...AlgSetItemFragmentFragmentDoc.definitions]} as unknown as DocumentNode<UpdateAlgSetItemMutation, UpdateAlgSetItemMutationVariables>;
export const RemoveAlgSetItemsDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RemoveAlgSetItems"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"set_id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"item_ids"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"removeAlgSetItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"set_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"set_id"}}},{"kind":"Argument","name":{"kind":"Name","value":"item_ids"},"value":{"kind":"Variable","name":{"kind":"Name","value":"item_ids"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AlgSetFragment"}}]}}]}},...AlgSetFragmentFragmentDoc.definitions,...AlgSetHeadFragmentFragmentDoc.definitions,...AlgSetItemFragmentFragmentDoc.definitions,...AlgSetOwnerFragmentFragmentDoc.definitions]} as unknown as DocumentNode<RemoveAlgSetItemsMutation, RemoveAlgSetItemsMutationVariables>;
export const ReorderAlgSetItemsDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ReorderAlgSetItems"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"set_id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"item_ids"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"reorderAlgSetItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"set_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"set_id"}}},{"kind":"Argument","name":{"kind":"Name","value":"item_ids"},"value":{"kind":"Variable","name":{"kind":"Name","value":"item_ids"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AlgSetFragment"}}]}}]}},...AlgSetFragmentFragmentDoc.definitions,...AlgSetHeadFragmentFragmentDoc.definitions,...AlgSetItemFragmentFragmentDoc.definitions,...AlgSetOwnerFragmentFragmentDoc.definitions]} as unknown as DocumentNode<ReorderAlgSetItemsMutation, ReorderAlgSetItemsMutationVariables>;
export const SaveAlgSetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SaveAlgSet"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"set_id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"saveAlgSet"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"set_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"set_id"}}}]}]}}]} as unknown as DocumentNode<SaveAlgSetMutation, SaveAlgSetMutationVariables>;
export const UnsaveAlgSetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UnsaveAlgSet"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"set_id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"unsaveAlgSet"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"set_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"set_id"}}}]}]}}]} as unknown as DocumentNode<UnsaveAlgSetMutation, UnsaveAlgSetMutationVariables>;
export const ReportAlgSetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ReportAlgSet"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"set_id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"reason"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"note"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"reportAlgSet"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"set_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"set_id"}}},{"kind":"Argument","name":{"kind":"Name","value":"reason"},"value":{"kind":"Variable","name":{"kind":"Name","value":"reason"}}},{"kind":"Argument","name":{"kind":"Name","value":"note"},"value":{"kind":"Variable","name":{"kind":"Name","value":"note"}}}]}]}}]} as unknown as DocumentNode<ReportAlgSetMutation, ReportAlgSetMutationVariables>;
export const AdminSetAlgSetHiddenDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AdminSetAlgSetHidden"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"set_id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"hidden"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"reason"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"adminSetAlgSetHidden"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"set_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"set_id"}}},{"kind":"Argument","name":{"kind":"Name","value":"hidden"},"value":{"kind":"Variable","name":{"kind":"Name","value":"hidden"}}},{"kind":"Argument","name":{"kind":"Name","value":"reason"},"value":{"kind":"Variable","name":{"kind":"Name","value":"reason"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AlgSetHeadFragment"}}]}}]}},...AlgSetHeadFragmentFragmentDoc.definitions,...AlgSetItemFragmentFragmentDoc.definitions,...AlgSetOwnerFragmentFragmentDoc.definitions]} as unknown as DocumentNode<AdminSetAlgSetHiddenMutation, AdminSetAlgSetHiddenMutationVariables>;
export const BattleLeaderboardDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"battleLeaderboard"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"puzzle"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"page"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"search"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"battleLeaderboard"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"puzzle"},"value":{"kind":"Variable","name":{"kind":"Name","value":"puzzle"}}},{"kind":"Argument","name":{"kind":"Name","value":"page"},"value":{"kind":"Variable","name":{"kind":"Name","value":"page"}}},{"kind":"Argument","name":{"kind":"Name","value":"search"},"value":{"kind":"Variable","name":{"kind":"Name","value":"search"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rows"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BattleLeaderboardRowFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"total_count"}},{"kind":"Field","name":{"kind":"Name","value":"page"}},{"kind":"Field","name":{"kind":"Name","value":"page_size"}}]}}]}},...BattleLeaderboardRowFragmentFragmentDoc.definitions]} as unknown as DocumentNode<BattleLeaderboardQuery, BattleLeaderboardQueryVariables>;
export const MyBattleRatingDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"myBattleRating"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"puzzle"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"myBattleRating"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"puzzle"},"value":{"kind":"Variable","name":{"kind":"Name","value":"puzzle"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"puzzle"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"provisional"}},{"kind":"Field","name":{"kind":"Name","value":"games"}},{"kind":"Field","name":{"kind":"Name","value":"wins"}},{"kind":"Field","name":{"kind":"Name","value":"losses"}},{"kind":"Field","name":{"kind":"Name","value":"draws"}},{"kind":"Field","name":{"kind":"Name","value":"peak_rating"}},{"kind":"Field","name":{"kind":"Name","value":"rank"}}]}}]}}]} as unknown as DocumentNode<MyBattleRatingQuery, MyBattleRatingQueryVariables>;
export const UserBattleRatingDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"userBattleRating"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"puzzle"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userBattleRating"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"userId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}},{"kind":"Argument","name":{"kind":"Name","value":"puzzle"},"value":{"kind":"Variable","name":{"kind":"Name","value":"puzzle"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"puzzle"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"provisional"}},{"kind":"Field","name":{"kind":"Name","value":"games"}},{"kind":"Field","name":{"kind":"Name","value":"wins"}},{"kind":"Field","name":{"kind":"Name","value":"losses"}},{"kind":"Field","name":{"kind":"Name","value":"draws"}},{"kind":"Field","name":{"kind":"Name","value":"peak_rating"}},{"kind":"Field","name":{"kind":"Name","value":"rank"}}]}}]}}]} as unknown as DocumentNode<UserBattleRatingQuery, UserBattleRatingQueryVariables>;
export const BattleMatchHistoryDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"battleMatchHistory"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"page"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"battleMatchHistory"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"userId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}},{"kind":"Argument","name":{"kind":"Name","value":"page"},"value":{"kind":"Variable","name":{"kind":"Name","value":"page"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"puzzle"}},{"kind":"Field","name":{"kind":"Name","value":"ended_at"}},{"kind":"Field","name":{"kind":"Name","value":"result"}},{"kind":"Field","name":{"kind":"Name","value":"score_for"}},{"kind":"Field","name":{"kind":"Name","value":"score_against"}},{"kind":"Field","name":{"kind":"Name","value":"rated"}},{"kind":"Field","name":{"kind":"Name","value":"is_rematch"}},{"kind":"Field","name":{"kind":"Name","value":"is_challenge"}},{"kind":"Field","name":{"kind":"Name","value":"end_reason"}},{"kind":"Field","name":{"kind":"Name","value":"rating_before"}},{"kind":"Field","name":{"kind":"Name","value":"rating_after"}},{"kind":"Field","name":{"kind":"Name","value":"delta"}},{"kind":"Field","name":{"kind":"Name","value":"opponent"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BattlePlayerFragment"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"hasMore"}}]}}]}},...BattlePlayerFragmentFragmentDoc.definitions]} as unknown as DocumentNode<BattleMatchHistoryQuery, BattleMatchHistoryQueryVariables>;
export const BattleMatchDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"battleMatch"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"battleMatch"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"puzzle"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"end_reason"}},{"kind":"Field","name":{"kind":"Name","value":"rated"}},{"kind":"Field","name":{"kind":"Name","value":"is_rematch"}},{"kind":"Field","name":{"kind":"Name","value":"is_challenge"}},{"kind":"Field","name":{"kind":"Name","value":"winner"}},{"kind":"Field","name":{"kind":"Name","value":"rounds_a"}},{"kind":"Field","name":{"kind":"Name","value":"rounds_b"}},{"kind":"Field","name":{"kind":"Name","value":"rating_a_before"}},{"kind":"Field","name":{"kind":"Name","value":"rating_a_after"}},{"kind":"Field","name":{"kind":"Name","value":"rating_b_before"}},{"kind":"Field","name":{"kind":"Name","value":"rating_b_after"}},{"kind":"Field","name":{"kind":"Name","value":"started_at"}},{"kind":"Field","name":{"kind":"Name","value":"ended_at"}},{"kind":"Field","name":{"kind":"Name","value":"voided_at"}},{"kind":"Field","name":{"kind":"Name","value":"flags"}},{"kind":"Field","name":{"kind":"Name","value":"viewer_side"}},{"kind":"Field","name":{"kind":"Name","value":"player_a"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BattlePlayerFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"player_b"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BattlePlayerFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"rounds"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"index"}},{"kind":"Field","name":{"kind":"Name","value":"scramble"}},{"kind":"Field","name":{"kind":"Name","value":"winner"}},{"kind":"Field","name":{"kind":"Name","value":"a_time_ms"}},{"kind":"Field","name":{"kind":"Name","value":"a_penalty"}},{"kind":"Field","name":{"kind":"Name","value":"b_time_ms"}},{"kind":"Field","name":{"kind":"Name","value":"b_penalty"}},{"kind":"Field","name":{"kind":"Name","value":"a_flags"}},{"kind":"Field","name":{"kind":"Name","value":"b_flags"}},{"kind":"Field","name":{"kind":"Name","value":"a_moves"}},{"kind":"Field","name":{"kind":"Name","value":"b_moves"}},{"kind":"Field","name":{"kind":"Name","value":"a_dnf_reason"}},{"kind":"Field","name":{"kind":"Name","value":"b_dnf_reason"}}]}}]}}]}},...BattlePlayerFragmentFragmentDoc.definitions]} as unknown as DocumentNode<BattleMatchQuery, BattleMatchQueryVariables>;
export const AdminFlaggedBattleMatchesDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"adminFlaggedBattleMatches"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"page"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"adminFlaggedBattleMatches"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"page"},"value":{"kind":"Variable","name":{"kind":"Name","value":"page"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"puzzle"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"end_reason"}},{"kind":"Field","name":{"kind":"Name","value":"rated"}},{"kind":"Field","name":{"kind":"Name","value":"is_challenge"}},{"kind":"Field","name":{"kind":"Name","value":"winner"}},{"kind":"Field","name":{"kind":"Name","value":"rounds_a"}},{"kind":"Field","name":{"kind":"Name","value":"rounds_b"}},{"kind":"Field","name":{"kind":"Name","value":"ended_at"}},{"kind":"Field","name":{"kind":"Name","value":"voided_at"}},{"kind":"Field","name":{"kind":"Name","value":"flags"}},{"kind":"Field","name":{"kind":"Name","value":"player_a"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BattlePlayerFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"player_b"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BattlePlayerFragment"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"hasMore"}}]}}]}},...BattlePlayerFragmentFragmentDoc.definitions]} as unknown as DocumentNode<AdminFlaggedBattleMatchesQuery, AdminFlaggedBattleMatchesQueryVariables>;
export const BattleChallengeDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"battleChallenge"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"code"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"battleChallenge"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"code"},"value":{"kind":"Variable","name":{"kind":"Name","value":"code"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"expires_at"}},{"kind":"Field","name":{"kind":"Name","value":"restricted"}},{"kind":"Field","name":{"kind":"Name","value":"own"}},{"kind":"Field","name":{"kind":"Name","value":"for_you"}},{"kind":"Field","name":{"kind":"Name","value":"from"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BattlePlayerFragment"}}]}}]}}]}},...BattlePlayerFragmentFragmentDoc.definitions]} as unknown as DocumentNode<BattleChallengeQuery, BattleChallengeQueryVariables>;
export const BattleHeadToHeadDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"battleHeadToHead"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"battleHeadToHead"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"userId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"wins"}},{"kind":"Field","name":{"kind":"Name","value":"losses"}},{"kind":"Field","name":{"kind":"Name","value":"draws"}}]}}]}}]} as unknown as DocumentNode<BattleHeadToHeadQuery, BattleHeadToHeadQueryVariables>;
export const AdminVoidBattleMatchDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"adminVoidBattleMatch"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"adminVoidBattleMatch"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"match_id"}},{"kind":"Field","name":{"kind":"Name","value":"changed"}},{"kind":"Field","name":{"kind":"Name","value":"reverted_a"}},{"kind":"Field","name":{"kind":"Name","value":"reverted_b"}}]}}]}}]} as unknown as DocumentNode<AdminVoidBattleMatchMutation, AdminVoidBattleMatchMutationVariables>;
export const MyCubeStateDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MyCubeState"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"myCubeState"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cubes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"CubeFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"mains"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"CubeMainFragment"}}]}}]}}]}},...CubeFragmentFragmentDoc.definitions,...CubeCalibrationFragmentFragmentDoc.definitions,...CubeMainFragmentFragmentDoc.definitions]} as unknown as DocumentNode<MyCubeStateQuery, MyCubeStateQueryVariables>;
export const CreateCubeDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateCube"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CubeInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createCube"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"CubeFragment"}}]}}]}},...CubeFragmentFragmentDoc.definitions,...CubeCalibrationFragmentFragmentDoc.definitions]} as unknown as DocumentNode<CreateCubeMutation, CreateCubeMutationVariables>;
export const UpdateCubeDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateCube"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CubeUpdateInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateCube"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"CubeFragment"}}]}}]}},...CubeFragmentFragmentDoc.definitions,...CubeCalibrationFragmentFragmentDoc.definitions]} as unknown as DocumentNode<UpdateCubeMutation, UpdateCubeMutationVariables>;
export const SetCubeArchivedDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetCubeArchived"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"archived"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setCubeArchived"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"archived"},"value":{"kind":"Variable","name":{"kind":"Name","value":"archived"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"CubeFragment"}}]}}]}},...CubeFragmentFragmentDoc.definitions,...CubeCalibrationFragmentFragmentDoc.definitions]} as unknown as DocumentNode<SetCubeArchivedMutation, SetCubeArchivedMutationVariables>;
export const DeleteCubeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteCube"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteCube"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<DeleteCubeMutation, DeleteCubeMutationVariables>;
export const SetMainCubeDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetMainCube"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"puzzle"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"cube_id"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"set_at"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"DateTime"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setMainCube"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"puzzle"},"value":{"kind":"Variable","name":{"kind":"Name","value":"puzzle"}}},{"kind":"Argument","name":{"kind":"Name","value":"cube_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"cube_id"}}},{"kind":"Argument","name":{"kind":"Name","value":"set_at"},"value":{"kind":"Variable","name":{"kind":"Name","value":"set_at"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"CubeMainFragment"}}]}}]}},...CubeMainFragmentFragmentDoc.definitions]} as unknown as DocumentNode<SetMainCubeMutation, SetMainCubeMutationVariables>;
export const EnsureSmartCubeDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"EnsureSmartCube"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ble_device_id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ble_name"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ensureSmartCube"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"ble_device_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ble_device_id"}}},{"kind":"Argument","name":{"kind":"Name","value":"ble_name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ble_name"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"CubeFragment"}}]}}]}},...CubeFragmentFragmentDoc.definitions,...CubeCalibrationFragmentFragmentDoc.definitions]} as unknown as DocumentNode<EnsureSmartCubeMutation, EnsureSmartCubeMutationVariables>;
export const SaveCubeCalibrationDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SaveCubeCalibration"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CubeCalibrationInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"saveCubeCalibration"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"CubeCalibrationFragment"}}]}}]}},...CubeCalibrationFragmentFragmentDoc.definitions]} as unknown as DocumentNode<SaveCubeCalibrationMutation, SaveCubeCalibrationMutationVariables>;
export const DeleteCubeCalibrationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteCubeCalibration"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteCubeCalibration"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<DeleteCubeCalibrationMutation, DeleteCubeCalibrationMutationVariables>;
export const AdminCubeCalibrationsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AdminCubeCalibrations"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"offset"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"username"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"puzzle"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"platform"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"deviceModel"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"adminCubeCalibrations"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}},{"kind":"Argument","name":{"kind":"Name","value":"offset"},"value":{"kind":"Variable","name":{"kind":"Name","value":"offset"}}},{"kind":"Argument","name":{"kind":"Name","value":"username"},"value":{"kind":"Variable","name":{"kind":"Name","value":"username"}}},{"kind":"Argument","name":{"kind":"Name","value":"puzzle"},"value":{"kind":"Variable","name":{"kind":"Name","value":"puzzle"}}},{"kind":"Argument","name":{"kind":"Name","value":"platform"},"value":{"kind":"Variable","name":{"kind":"Name","value":"platform"}}},{"kind":"Argument","name":{"kind":"Name","value":"deviceModel"},"value":{"kind":"Variable","name":{"kind":"Name","value":"deviceModel"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"user_id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"cube_id"}},{"kind":"Field","name":{"kind":"Name","value":"cube_name"}},{"kind":"Field","name":{"kind":"Name","value":"cube_brand"}},{"kind":"Field","name":{"kind":"Name","value":"puzzle"}},{"kind":"Field","name":{"kind":"Name","value":"puzzle_name"}},{"kind":"Field","name":{"kind":"Name","value":"platform"}},{"kind":"Field","name":{"kind":"Name","value":"device_model"}},{"kind":"Field","name":{"kind":"Name","value":"os_version"}},{"kind":"Field","name":{"kind":"Name","value":"app_version"}},{"kind":"Field","name":{"kind":"Name","value":"sensor_name"}},{"kind":"Field","name":{"kind":"Name","value":"peak_ut"}},{"kind":"Field","name":{"kind":"Name","value":"rest_ut"}},{"kind":"Field","name":{"kind":"Name","value":"noise_ut"}},{"kind":"Field","name":{"kind":"Name","value":"near_min_ut"}},{"kind":"Field","name":{"kind":"Name","value":"far_max_ut"}},{"kind":"Field","name":{"kind":"Name","value":"quality"}},{"kind":"Field","name":{"kind":"Name","value":"current_near_min_ut"}},{"kind":"Field","name":{"kind":"Name","value":"current_far_max_ut"}},{"kind":"Field","name":{"kind":"Name","value":"current_quality"}},{"kind":"Field","name":{"kind":"Name","value":"noisy"}},{"kind":"Field","name":{"kind":"Name","value":"sample_count"}},{"kind":"Field","name":{"kind":"Name","value":"sweep_ms"}},{"kind":"Field","name":{"kind":"Name","value":"rate_hz"}},{"kind":"Field","name":{"kind":"Name","value":"algo_version"}},{"kind":"Field","name":{"kind":"Name","value":"measured_at"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"updated_at"}}]}}]}}]} as unknown as DocumentNode<AdminCubeCalibrationsQuery, AdminCubeCalibrationsQueryVariables>;
export const AdminCubeCalibrationSummaryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AdminCubeCalibrationSummary"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"days"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"adminCubeCalibrationSummary"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"days"},"value":{"kind":"Variable","name":{"kind":"Name","value":"days"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"puzzle"}},{"kind":"Field","name":{"kind":"Name","value":"platform"}},{"kind":"Field","name":{"kind":"Name","value":"device_model"}},{"kind":"Field","name":{"kind":"Name","value":"calibrations"}},{"kind":"Field","name":{"kind":"Name","value":"distinct_users"}},{"kind":"Field","name":{"kind":"Name","value":"median_rest_ut"}},{"kind":"Field","name":{"kind":"Name","value":"p10_rest_ut"}},{"kind":"Field","name":{"kind":"Name","value":"median_peak_ut"}},{"kind":"Field","name":{"kind":"Name","value":"median_noise_ut"}},{"kind":"Field","name":{"kind":"Name","value":"weak_ratio"}},{"kind":"Field","name":{"kind":"Name","value":"telemetry_placements"}},{"kind":"Field","name":{"kind":"Name","value":"telemetry_median_near_ut"}},{"kind":"Field","name":{"kind":"Name","value":"telemetry_lifts"}},{"kind":"Field","name":{"kind":"Name","value":"telemetry_rejects"}}]}}]}}]} as unknown as DocumentNode<AdminCubeCalibrationSummaryQuery, AdminCubeCalibrationSummaryQueryVariables>;
export const LinkRevenueCatUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"linkRevenueCatUser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"linkRevenueCatUser"}}]}}]} as unknown as DocumentNode<LinkRevenueCatUserMutation, LinkRevenueCatUserMutationVariables>;
export const CreateSupportTicketDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateSupportTicket"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SupportTicketInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createSupportTicket"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<CreateSupportTicketMutation, CreateSupportTicketMutationVariables>;
export const ResolveSupportTicketDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ResolveSupportTicket"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"resolveSupportTicket"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"resolved_at"}}]}}]}}]} as unknown as DocumentNode<ResolveSupportTicketMutation, ResolveSupportTicketMutationVariables>;
export const AddSupportTicketMessageDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddSupportTicketMessage"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ticketId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"body"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"attachments"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Upload"}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addSupportTicketMessage"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"ticketId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ticketId"}}},{"kind":"Argument","name":{"kind":"Name","value":"body"},"value":{"kind":"Variable","name":{"kind":"Name","value":"body"}}},{"kind":"Argument","name":{"kind":"Name","value":"attachments"},"value":{"kind":"Variable","name":{"kind":"Name","value":"attachments"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"is_admin"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"attachments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"storage_path"}},{"kind":"Field","name":{"kind":"Name","value":"mime_type"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"size_bytes"}},{"kind":"Field","name":{"kind":"Name","value":"original_name"}}]}}]}}]}}]} as unknown as DocumentNode<AddSupportTicketMessageMutation, AddSupportTicketMessageMutationVariables>;
export const UpdateLocaleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateLocale"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"locale"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setSetting"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"locale"},"value":{"kind":"Variable","name":{"kind":"Name","value":"locale"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<UpdateLocaleMutation, UpdateLocaleMutationVariables>;
export const VoteReconstructionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"VoteReconstruction"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"vote"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"voteReconstruction"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"vote"},"value":{"kind":"Variable","name":{"kind":"Name","value":"vote"}}}]}]}}]} as unknown as DocumentNode<VoteReconstructionMutation, VoteReconstructionMutationVariables>;
export const UpdateSiteConfigDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"updateSiteConfig"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateSiteConfigInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateSiteConfig"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"maintenance_mode"}},{"kind":"Field","name":{"kind":"Name","value":"trainer_enabled"}},{"kind":"Field","name":{"kind":"Name","value":"community_enabled"}},{"kind":"Field","name":{"kind":"Name","value":"leaderboards_enabled"}},{"kind":"Field","name":{"kind":"Name","value":"rooms_enabled"}},{"kind":"Field","name":{"kind":"Name","value":"battle_enabled"}},{"kind":"Field","name":{"kind":"Name","value":"messaging_enabled"}},{"kind":"Field","name":{"kind":"Name","value":"presence_enabled"}},{"kind":"Field","name":{"kind":"Name","value":"pro_enabled"}},{"kind":"Field","name":{"kind":"Name","value":"wca_backfill_enabled"}},{"kind":"Field","name":{"kind":"Name","value":"zkt_backfill_enabled"}},{"kind":"Field","name":{"kind":"Name","value":"smart_telemetry_enabled"}},{"kind":"Field","name":{"kind":"Name","value":"magnet_telemetry_enabled"}},{"kind":"Field","name":{"kind":"Name","value":"online_battle_enabled"}},{"kind":"Field","name":{"kind":"Name","value":"featureOverrides"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"feature"}},{"kind":"Field","name":{"kind":"Name","value":"mode"}},{"kind":"Field","name":{"kind":"Name","value":"users"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"updated_at"}}]}}]}}]} as unknown as DocumentNode<UpdateSiteConfigMutation, UpdateSiteConfigMutationVariables>;
export const MergeSessionsDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"mergeSessions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"oldSessionId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"newSessionId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mergeSessions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"oldSessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"oldSessionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"newSessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"newSessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SessionFragment"}}]}}]}},...SessionFragmentFragmentDoc.definitions]} as unknown as DocumentNode<MergeSessionsMutation, MergeSessionsMutationVariables>;
export const SplitSessionDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"splitSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"buckets"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SessionBucketInput"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"splitSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"buckets"},"value":{"kind":"Variable","name":{"kind":"Name","value":"buckets"}}},{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SessionFragment"}}]}}]}},...SessionFragmentFragmentDoc.definitions]} as unknown as DocumentNode<SplitSessionMutation, SplitSessionMutationVariables>;
export const CreateSessionDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"createSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"SessionInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SessionFragment"}}]}}]}},...SessionFragmentFragmentDoc.definitions]} as unknown as DocumentNode<CreateSessionMutation, CreateSessionMutationVariables>;
export const UpdateSessionDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"updateSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"SessionInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SessionFragment"}}]}}]}},...SessionFragmentFragmentDoc.definitions]} as unknown as DocumentNode<UpdateSessionMutation, UpdateSessionMutationVariables>;
export const DeleteSessionDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"deleteSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SessionFragment"}}]}}]}},...SessionFragmentFragmentDoc.definitions]} as unknown as DocumentNode<DeleteSessionMutation, DeleteSessionMutationVariables>;
export const ReorderSessionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"reorderSessions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ids"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"reorderSessions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"ids"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ids"}}}]}]}}]} as unknown as DocumentNode<ReorderSessionsMutation, ReorderSessionsMutationVariables>;
export const BulkDeleteSessionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"bulkDeleteSessions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ids"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"bulkDeleteSessions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"ids"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ids"}}}]}]}}]} as unknown as DocumentNode<BulkDeleteSessionsMutation, BulkDeleteSessionsMutationVariables>;
export const CreateAnnouncementDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"createAnnouncement"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateAnnouncementInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createAnnouncement"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"isDraft"}},{"kind":"Field","name":{"kind":"Name","value":"targetUrl"}}]}}]}}]} as unknown as DocumentNode<CreateAnnouncementMutation, CreateAnnouncementMutationVariables>;
export const UpdateAnnouncementDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"updateAnnouncement"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateAnnouncementInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateAnnouncement"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"isDraft"}},{"kind":"Field","name":{"kind":"Name","value":"targetUrl"}}]}}]}}]} as unknown as DocumentNode<UpdateAnnouncementMutation, UpdateAnnouncementMutationVariables>;
export const MarkAnnouncementAsViewedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"markAnnouncementAsViewed"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"announcementId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"markAnnouncementAsViewed"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"announcementId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"announcementId"}}}]}]}}]} as unknown as DocumentNode<MarkAnnouncementAsViewedMutation, MarkAnnouncementAsViewedMutationVariables>;
export const DeleteAnnouncementDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"deleteAnnouncement"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteAnnouncement"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<DeleteAnnouncementMutation, DeleteAnnouncementMutationVariables>;
export const TranslateAnnouncementContentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"translateAnnouncementContent"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"title"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"content"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"translateAnnouncementContent"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"title"},"value":{"kind":"Variable","name":{"kind":"Name","value":"title"}}},{"kind":"Argument","name":{"kind":"Name","value":"content"},"value":{"kind":"Variable","name":{"kind":"Name","value":"content"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"title"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"en"}},{"kind":"Field","name":{"kind":"Name","value":"es"}},{"kind":"Field","name":{"kind":"Name","value":"ru"}},{"kind":"Field","name":{"kind":"Name","value":"zh"}}]}},{"kind":"Field","name":{"kind":"Name","value":"content"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"en"}},{"kind":"Field","name":{"kind":"Name","value":"es"}},{"kind":"Field","name":{"kind":"Name","value":"ru"}},{"kind":"Field","name":{"kind":"Name","value":"zh"}}]}}]}}]}}]} as unknown as DocumentNode<TranslateAnnouncementContentMutation, TranslateAnnouncementContentMutationVariables>;
export const AdminDeleteTrainerAlternativeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"adminDeleteTrainerAlternative"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"adminDeleteTrainerAlternative"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<AdminDeleteTrainerAlternativeMutation, AdminDeleteTrainerAlternativeMutationVariables>;
export const BackfillWcaIdsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"backfillWcaIds"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"backfillWcaIds"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"filled"}},{"kind":"Field","name":{"kind":"Name","value":"tokenFailed"}},{"kind":"Field","name":{"kind":"Name","value":"noWcaId"}},{"kind":"Field","name":{"kind":"Name","value":"error"}},{"kind":"Field","name":{"kind":"Name","value":"recordsTotal"}},{"kind":"Field","name":{"kind":"Name","value":"recordsFilled"}},{"kind":"Field","name":{"kind":"Name","value":"recordsError"}}]}}]}}]} as unknown as DocumentNode<BackfillWcaIdsMutation, BackfillWcaIdsMutationVariables>;
export const BackfillZktIdsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"backfillZktIds"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"backfillZktIds"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"filled"}},{"kind":"Field","name":{"kind":"Name","value":"stillNull"}},{"kind":"Field","name":{"kind":"Name","value":"conflict"}},{"kind":"Field","name":{"kind":"Name","value":"error"}}]}}]}}]} as unknown as DocumentNode<BackfillZktIdsMutation, BackfillZktIdsMutationVariables>;
export const FollowCompetitorDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"followCompetitor"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"FollowCompetitorInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"followCompetitor"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"competition_id"}},{"kind":"Field","name":{"kind":"Name","value":"followed_registrant_id"}},{"kind":"Field","name":{"kind":"Name","value":"followed_wca_id"}},{"kind":"Field","name":{"kind":"Name","value":"followed_name"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}}]}}]} as unknown as DocumentNode<FollowCompetitorMutation, FollowCompetitorMutationVariables>;
export const UnfollowCompetitorDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"unfollowCompetitor"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"unfollowCompetitor"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<UnfollowCompetitorMutation, UnfollowCompetitorMutationVariables>;
export const RecordActivityHeartbeatDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"recordActivityHeartbeat"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"recordActivityHeartbeat"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}}]}}]}}]} as unknown as DocumentNode<RecordActivityHeartbeatMutation, RecordActivityHeartbeatMutationVariables>;
export const SendMessageDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"sendMessage"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"body"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"recipientId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"conversationId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"solveId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"replyToId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sendMessage"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"body"},"value":{"kind":"Variable","name":{"kind":"Name","value":"body"}}},{"kind":"Argument","name":{"kind":"Name","value":"recipientId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"recipientId"}}},{"kind":"Argument","name":{"kind":"Name","value":"conversationId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"conversationId"}}},{"kind":"Argument","name":{"kind":"Name","value":"solveId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"solveId"}}},{"kind":"Argument","name":{"kind":"Name","value":"replyToId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"replyToId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MessageFragment"}}]}}]}},...MessageFragmentFragmentDoc.definitions,...PublicUserFragmentFragmentDoc.definitions,...ImageFragmentFragmentDoc.definitions,...DmSolveFragmentFragmentDoc.definitions]} as unknown as DocumentNode<SendMessageMutation, SendMessageMutationVariables>;
export const MarkConversationReadDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"markConversationRead"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"conversationId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"markConversationRead"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"conversationId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"conversationId"}}}]}]}}]} as unknown as DocumentNode<MarkConversationReadMutation, MarkConversationReadMutationVariables>;
export const ArchiveConversationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"archiveConversation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"conversationId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"archiveConversation"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"conversationId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"conversationId"}}}]}]}}]} as unknown as DocumentNode<ArchiveConversationMutation, ArchiveConversationMutationVariables>;
export const SetMessageReactionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"setMessageReaction"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"messageId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"emoji"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setMessageReaction"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"messageId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"messageId"}}},{"kind":"Argument","name":{"kind":"Name","value":"emoji"},"value":{"kind":"Variable","name":{"kind":"Name","value":"emoji"}}}]}]}}]} as unknown as DocumentNode<SetMessageReactionMutation, SetMessageReactionMutationVariables>;
export const SetConversationMutedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"setConversationMuted"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"conversationId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"muted"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setConversationMuted"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"conversationId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"conversationId"}}},{"kind":"Argument","name":{"kind":"Name","value":"muted"},"value":{"kind":"Variable","name":{"kind":"Name","value":"muted"}}}]}]}}]} as unknown as DocumentNode<SetConversationMutedMutation, SetConversationMutedMutationVariables>;
export const AcceptConversationRequestDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"acceptConversationRequest"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"conversationId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"acceptConversationRequest"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"conversationId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"conversationId"}}}]}]}}]} as unknown as DocumentNode<AcceptConversationRequestMutation, AcceptConversationRequestMutationVariables>;
export const EditMessageDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"editMessage"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"messageId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"body"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"editMessage"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"messageId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"messageId"}}},{"kind":"Argument","name":{"kind":"Name","value":"body"},"value":{"kind":"Variable","name":{"kind":"Name","value":"body"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MessageFragment"}}]}}]}},...MessageFragmentFragmentDoc.definitions,...PublicUserFragmentFragmentDoc.definitions,...ImageFragmentFragmentDoc.definitions,...DmSolveFragmentFragmentDoc.definitions]} as unknown as DocumentNode<EditMessageMutation, EditMessageMutationVariables>;
export const UnsendMessageDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"unsendMessage"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"messageId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"unsendMessage"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"messageId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"messageId"}}}]}]}}]} as unknown as DocumentNode<UnsendMessageMutation, UnsendMessageMutationVariables>;
export const ClearConversationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"clearConversation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"conversationId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"clearConversation"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"conversationId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"conversationId"}}}]}]}}]} as unknown as DocumentNode<ClearConversationMutation, ClearConversationMutationVariables>;
export const SetTypingDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"setTyping"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"conversationId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"typing"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setTyping"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"conversationId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"conversationId"}}},{"kind":"Argument","name":{"kind":"Name","value":"typing"},"value":{"kind":"Variable","name":{"kind":"Name","value":"typing"}}}]}]}}]} as unknown as DocumentNode<SetTypingMutation, SetTypingMutationVariables>;
export const ReportConversationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"reportConversation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"conversationId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"reason"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"reportConversation"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"conversationId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"conversationId"}}},{"kind":"Argument","name":{"kind":"Name","value":"reason"},"value":{"kind":"Variable","name":{"kind":"Name","value":"reason"}}}]}]}}]} as unknown as DocumentNode<ReportConversationMutation, ReportConversationMutationVariables>;
export const ResolveMessageReportDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"resolveMessageReport"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"reportId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"action"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ReportStatus"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"note"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"resolveMessageReport"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"reportId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"reportId"}}},{"kind":"Argument","name":{"kind":"Name","value":"action"},"value":{"kind":"Variable","name":{"kind":"Name","value":"action"}}},{"kind":"Argument","name":{"kind":"Name","value":"note"},"value":{"kind":"Variable","name":{"kind":"Name","value":"note"}}}]}]}}]} as unknown as DocumentNode<ResolveMessageReportMutation, ResolveMessageReportMutationVariables>;
export const BlockUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"blockUser"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"blockUser"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"userId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}]}]}}]} as unknown as DocumentNode<BlockUserMutation, BlockUserMutationVariables>;
export const UnblockUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"unblockUser"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"unblockUser"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"userId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}]}]}}]} as unknown as DocumentNode<UnblockUserMutation, UnblockUserMutationVariables>;
export const UpdateSocialPreferenceDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"updateSocialPreference"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateSocialPreferenceInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateSocialPreference"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"dm_policy"}},{"kind":"Field","name":{"kind":"Name","value":"searchable"}},{"kind":"Field","name":{"kind":"Name","value":"dm_push"}},{"kind":"Field","name":{"kind":"Name","value":"read_receipts"}},{"kind":"Field","name":{"kind":"Name","value":"typing_indicator"}},{"kind":"Field","name":{"kind":"Name","value":"online_status"}}]}}]}}]} as unknown as DocumentNode<UpdateSocialPreferenceMutation, UpdateSocialPreferenceMutationVariables>;
export const RecordSmartCubeTelemetryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RecordSmartCubeTelemetry"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"events"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SmartCubeTelemetryInput"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"recordSmartCubeTelemetry"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"events"},"value":{"kind":"Variable","name":{"kind":"Name","value":"events"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"accepted"}}]}}]}}]} as unknown as DocumentNode<RecordSmartCubeTelemetryMutation, RecordSmartCubeTelemetryMutationVariables>;
export const RecordMagnetTelemetryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RecordMagnetTelemetry"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"events"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"MagnetTelemetryInput"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"recordMagnetTelemetry"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"events"},"value":{"kind":"Variable","name":{"kind":"Name","value":"events"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"accepted"}},{"kind":"Field","name":{"kind":"Name","value":"enabled"}}]}}]}}]} as unknown as DocumentNode<RecordMagnetTelemetryMutation, RecordMagnetTelemetryMutationVariables>;
export const RecordProfileViewDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"recordProfileView"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"username"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"recordProfileView"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"username"},"value":{"kind":"Variable","name":{"kind":"Name","value":"username"}}}]}]}}]} as unknown as DocumentNode<RecordProfileViewMutation, RecordProfileViewMutationVariables>;
export const RecordSolveViewDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"recordSolveView"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"shareCode"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"recordSolveView"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"shareCode"},"value":{"kind":"Variable","name":{"kind":"Name","value":"shareCode"}}}]}]}}]} as unknown as DocumentNode<RecordSolveViewMutation, RecordSolveViewMutationVariables>;
export const AdminSupportTicketsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AdminSupportTickets"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"resolved"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"supportTickets"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"resolved"},"value":{"kind":"Variable","name":{"kind":"Name","value":"resolved"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"subject"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"resolved_at"}},{"kind":"Field","name":{"kind":"Name","value":"created_by_id"}},{"kind":"Field","name":{"kind":"Name","value":"created_by"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"profile"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pfp_image"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"user_id"}},{"kind":"Field","name":{"kind":"Name","value":"storage_path"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"messages"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"is_admin"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"sender"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"profile"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pfp_image"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"user_id"}},{"kind":"Field","name":{"kind":"Name","value":"storage_path"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"attachments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"storage_path"}},{"kind":"Field","name":{"kind":"Name","value":"mime_type"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"size_bytes"}},{"kind":"Field","name":{"kind":"Name","value":"original_name"}}]}}]}}]}}]}}]} as unknown as DocumentNode<AdminSupportTicketsQuery, AdminSupportTicketsQueryVariables>;
export const MySupportTicketsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MySupportTickets"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mySupportTickets"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"subject"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"resolved_at"}},{"kind":"Field","name":{"kind":"Name","value":"created_by_id"}},{"kind":"Field","name":{"kind":"Name","value":"messages"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"is_admin"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"sender"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"profile"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pfp_image"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"user_id"}},{"kind":"Field","name":{"kind":"Name","value":"storage_path"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"attachments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"storage_path"}},{"kind":"Field","name":{"kind":"Name","value":"mime_type"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"size_bytes"}},{"kind":"Field","name":{"kind":"Name","value":"original_name"}}]}}]}}]}}]}}]} as unknown as DocumentNode<MySupportTicketsQuery, MySupportTicketsQueryVariables>;
export const SupportTicketDetailDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SupportTicketDetail"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"supportTicket"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"subject"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"resolved_at"}},{"kind":"Field","name":{"kind":"Name","value":"created_by_id"}},{"kind":"Field","name":{"kind":"Name","value":"created_by"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"profile"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pfp_image"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"user_id"}},{"kind":"Field","name":{"kind":"Name","value":"storage_path"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"messages"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"is_admin"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"sender"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"profile"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pfp_image"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"user_id"}},{"kind":"Field","name":{"kind":"Name","value":"storage_path"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"attachments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"storage_path"}},{"kind":"Field","name":{"kind":"Name","value":"mime_type"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"size_bytes"}},{"kind":"Field","name":{"kind":"Name","value":"original_name"}}]}}]}}]}}]}}]} as unknown as DocumentNode<SupportTicketDetailQuery, SupportTicketDetailQueryVariables>;
export const GetIapStatusDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"getIapStatus"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getIapStatus"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"is_pro"}},{"kind":"Field","name":{"kind":"Name","value":"pro_expires_at"}},{"kind":"Field","name":{"kind":"Name","value":"iap_platform"}},{"kind":"Field","name":{"kind":"Name","value":"iap_product_id"}},{"kind":"Field","name":{"kind":"Name","value":"iap_cancellation_at"}},{"kind":"Field","name":{"kind":"Name","value":"iap_billing_issue_at"}},{"kind":"Field","name":{"kind":"Name","value":"iap_paused_until"}},{"kind":"Field","name":{"kind":"Name","value":"is_iap_pro"}},{"kind":"Field","name":{"kind":"Name","value":"can_purchase"}}]}}]}}]} as unknown as DocumentNode<GetIapStatusQuery, GetIapStatusQueryVariables>;
export const TrainerOptionsSettingDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"TrainerOptionsSetting"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"settings"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"trainer_options"}}]}}]}}]} as unknown as DocumentNode<TrainerOptionsSettingQuery, TrainerOptionsSettingQueryVariables>;
export const SiteConfigDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"siteConfig"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"siteConfig"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"maintenance_mode"}},{"kind":"Field","name":{"kind":"Name","value":"trainer_enabled"}},{"kind":"Field","name":{"kind":"Name","value":"community_enabled"}},{"kind":"Field","name":{"kind":"Name","value":"leaderboards_enabled"}},{"kind":"Field","name":{"kind":"Name","value":"rooms_enabled"}},{"kind":"Field","name":{"kind":"Name","value":"battle_enabled"}},{"kind":"Field","name":{"kind":"Name","value":"messaging_enabled"}},{"kind":"Field","name":{"kind":"Name","value":"presence_enabled"}},{"kind":"Field","name":{"kind":"Name","value":"pro_enabled"}},{"kind":"Field","name":{"kind":"Name","value":"wca_backfill_enabled"}},{"kind":"Field","name":{"kind":"Name","value":"zkt_backfill_enabled"}},{"kind":"Field","name":{"kind":"Name","value":"smart_telemetry_enabled"}},{"kind":"Field","name":{"kind":"Name","value":"magnet_telemetry_enabled"}},{"kind":"Field","name":{"kind":"Name","value":"online_battle_enabled"}},{"kind":"Field","name":{"kind":"Name","value":"method_steps_version"}},{"kind":"Field","name":{"kind":"Name","value":"featureOverrides"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"feature"}},{"kind":"Field","name":{"kind":"Name","value":"mode"}},{"kind":"Field","name":{"kind":"Name","value":"users"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"updated_at"}}]}}]}}]} as unknown as DocumentNode<SiteConfigQuery, SiteConfigQueryVariables>;
export const OnlineStatsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"onlineStats"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"onlineStats"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalSockets"}},{"kind":"Field","name":{"kind":"Name","value":"uniqueUsers"}},{"kind":"Field","name":{"kind":"Name","value":"anonymous"}}]}}]}}]} as unknown as DocumentNode<OnlineStatsQuery, OnlineStatsQueryVariables>;
export const WcaStatsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"wcaStats"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"wcaStats"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalUsers"}},{"kind":"Field","name":{"kind":"Name","value":"wcaConnected"}},{"kind":"Field","name":{"kind":"Name","value":"wcaWithId"}},{"kind":"Field","name":{"kind":"Name","value":"wcaWithoutId"}}]}}]}}]} as unknown as DocumentNode<WcaStatsQuery, WcaStatsQueryVariables>;
export const OnlineUsersDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"onlineUsers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"onlineUsers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tabCount"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserFragment"}}]}}]}}]}},...PublicUserFragmentFragmentDoc.definitions,...ImageFragmentFragmentDoc.definitions]} as unknown as DocumentNode<OnlineUsersQuery, OnlineUsersQueryVariables>;
export const SolveByShareCodeDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"solveByShareCode"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"shareCode"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"solveByShareCode"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"shareCode"},"value":{"kind":"Variable","name":{"kind":"Name","value":"shareCode"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SolveWithUserFragment"}}]}}]}},...SolveWithUserFragmentFragmentDoc.definitions,...SolveFragmentFragmentDoc.definitions,...PublicUserFragmentFragmentDoc.definitions,...ImageFragmentFragmentDoc.definitions]} as unknown as DocumentNode<SolveByShareCodeQuery, SolveByShareCodeQueryVariables>;
export const SolveReplayDataDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"solveReplayData"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"shareCode"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"solveReplayData"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"shareCode"},"value":{"kind":"Variable","name":{"kind":"Name","value":"shareCode"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"smart_gyro"}},{"kind":"Field","name":{"kind":"Name","value":"reconstruction_vote"}},{"kind":"Field","name":{"kind":"Name","value":"is_owner"}}]}}]}}]} as unknown as DocumentNode<SolveReplayDataQuery, SolveReplayDataQueryVariables>;
export const ProfileDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"profile"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"username"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"profile"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"username"},"value":{"kind":"Variable","name":{"kind":"Name","value":"username"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ProfileFragment"}}]}}]}},...ProfileFragmentFragmentDoc.definitions,...PublicUserFragmentFragmentDoc.definitions,...ImageFragmentFragmentDoc.definitions,...TopSolveFragmentFragmentDoc.definitions,...SolveFragmentFragmentDoc.definitions,...TopAverageFragmentFragmentDoc.definitions]} as unknown as DocumentNode<ProfileQuery, ProfileQueryVariables>;
export const UserSearchDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"userSearch"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pageArgs"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"PaginationArgsInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userSearch"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"pageArgs"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pageArgs"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasMore"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserFragment"}}]}}]}}]}},...PublicUserFragmentFragmentDoc.definitions,...ImageFragmentFragmentDoc.definitions]} as unknown as DocumentNode<UserSearchQuery, UserSearchQueryVariables>;
export const AdminUserSearchDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"adminUserSearch"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pageArgs"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"PaginationArgsInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"adminUserSearch"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"pageArgs"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pageArgs"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasMore"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"UserAccountFragment"}}]}}]}}]}},...UserAccountFragmentFragmentDoc.definitions,...PublicUserFragmentFragmentDoc.definitions,...ImageFragmentFragmentDoc.definitions]} as unknown as DocumentNode<AdminUserSearchQuery, AdminUserSearchQueryVariables>;
export const GetActiveAnnouncementsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"getActiveAnnouncements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getActiveAnnouncements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"targetUrl"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"hasViewed"}},{"kind":"Field","name":{"kind":"Name","value":"showInApp"}}]}}]}}]} as unknown as DocumentNode<GetActiveAnnouncementsQuery, GetActiveAnnouncementsQueryVariables>;
export const GetAllAnnouncementsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"getAllAnnouncements"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"AnnouncementFilterInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getAllAnnouncements"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"targetUrl"}},{"kind":"Field","name":{"kind":"Name","value":"translations"}},{"kind":"Field","name":{"kind":"Name","value":"isDraft"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}},{"kind":"Field","name":{"kind":"Name","value":"showInApp"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"viewCount"}},{"kind":"Field","name":{"kind":"Name","value":"pushSentAt"}},{"kind":"Field","name":{"kind":"Name","value":"pushSuccessCount"}},{"kind":"Field","name":{"kind":"Name","value":"pushTargetCount"}}]}}]}}]} as unknown as DocumentNode<GetAllAnnouncementsQuery, GetAllAnnouncementsQueryVariables>;
export const GetMyAnnouncementHistoryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"getMyAnnouncementHistory"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"offset"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getMyAnnouncementHistory"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}},{"kind":"Argument","name":{"kind":"Name","value":"offset"},"value":{"kind":"Variable","name":{"kind":"Name","value":"offset"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"targetUrl"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<GetMyAnnouncementHistoryQuery, GetMyAnnouncementHistoryQueryVariables>;
export const TrainerAlternativesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"trainerAlternatives"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"category"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"caseName"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"trainerAlternatives"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"category"},"value":{"kind":"Variable","name":{"kind":"Name","value":"category"}}},{"kind":"Argument","name":{"kind":"Name","value":"caseName"},"value":{"kind":"Variable","name":{"kind":"Name","value":"caseName"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"algorithm"}},{"kind":"Field","name":{"kind":"Name","value":"original_input"}},{"kind":"Field","name":{"kind":"Name","value":"setup"}},{"kind":"Field","name":{"kind":"Name","value":"ll_pattern"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}}]}}]} as unknown as DocumentNode<TrainerAlternativesQuery, TrainerAlternativesQueryVariables>;
export const TrainerLibraryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"trainerLibrary"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"knownVersion"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"trainerLibrary"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"knownVersion"},"value":{"kind":"Variable","name":{"kind":"Name","value":"knownVersion"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"subsets"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"subset"}},{"kind":"Field","name":{"kind":"Name","value":"algorithms"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"algorithm"}},{"kind":"Field","name":{"kind":"Name","value":"setup"}},{"kind":"Field","name":{"kind":"Name","value":"alternativeCount"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<TrainerLibraryQuery, TrainerLibraryQueryVariables>;
export const TrainerLibraryAlternativesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"trainerLibraryAlternatives"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"category"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"trainerLibraryAlternatives"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"category"},"value":{"kind":"Variable","name":{"kind":"Name","value":"category"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"cases"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"alternatives"}}]}}]}}]}}]} as unknown as DocumentNode<TrainerLibraryAlternativesQuery, TrainerLibraryAlternativesQueryVariables>;
export const WcaCompetitionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"wcaCompetitions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"WcaCompetitionFilterInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"wcaCompetitions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"city"}},{"kind":"Field","name":{"kind":"Name","value":"country_iso2"}},{"kind":"Field","name":{"kind":"Name","value":"venue"}},{"kind":"Field","name":{"kind":"Name","value":"start_date"}},{"kind":"Field","name":{"kind":"Name","value":"end_date"}},{"kind":"Field","name":{"kind":"Name","value":"date_range"}},{"kind":"Field","name":{"kind":"Name","value":"event_ids"}},{"kind":"Field","name":{"kind":"Name","value":"latitude_degrees"}},{"kind":"Field","name":{"kind":"Name","value":"longitude_degrees"}},{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"competitor_limit"}}]}}]}}]} as unknown as DocumentNode<WcaCompetitionsQuery, WcaCompetitionsQueryVariables>;
export const WcaSearchCompetitionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"wcaSearchCompetitions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"query"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"wcaSearchCompetitions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"query"},"value":{"kind":"Variable","name":{"kind":"Name","value":"query"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"city"}},{"kind":"Field","name":{"kind":"Name","value":"country_iso2"}},{"kind":"Field","name":{"kind":"Name","value":"start_date"}},{"kind":"Field","name":{"kind":"Name","value":"end_date"}},{"kind":"Field","name":{"kind":"Name","value":"event_ids"}},{"kind":"Field","name":{"kind":"Name","value":"url"}}]}}]}}]} as unknown as DocumentNode<WcaSearchCompetitionsQuery, WcaSearchCompetitionsQueryVariables>;
export const MyWcaCompetitionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"myWcaCompetitions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"myWcaCompetitions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"city"}},{"kind":"Field","name":{"kind":"Name","value":"country_iso2"}},{"kind":"Field","name":{"kind":"Name","value":"start_date"}},{"kind":"Field","name":{"kind":"Name","value":"end_date"}},{"kind":"Field","name":{"kind":"Name","value":"event_ids"}},{"kind":"Field","name":{"kind":"Name","value":"url"}}]}}]}}]} as unknown as DocumentNode<MyWcaCompetitionsQuery, MyWcaCompetitionsQueryVariables>;
export const WcaCompetitionDetailDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"wcaCompetitionDetail"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"WcaScheduleInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"wcaCompetitionDetail"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"competitionId"}},{"kind":"Field","name":{"kind":"Name","value":"competitionName"}},{"kind":"Field","name":{"kind":"Name","value":"myWcaId"}},{"kind":"Field","name":{"kind":"Name","value":"myRegistrantId"}},{"kind":"Field","name":{"kind":"Name","value":"myRegistrationStatus"}},{"kind":"Field","name":{"kind":"Name","value":"myRegisteredEvents"}},{"kind":"Field","name":{"kind":"Name","value":"days"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"named"}}]}},{"kind":"Field","name":{"kind":"Name","value":"myDayLabel"}},{"kind":"Field","name":{"kind":"Name","value":"competitors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"wcaId"}},{"kind":"Field","name":{"kind":"Name","value":"zktId"}},{"kind":"Field","name":{"kind":"Name","value":"country"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"registrantId"}},{"kind":"Field","name":{"kind":"Name","value":"wcaUserId"}},{"kind":"Field","name":{"kind":"Name","value":"registeredEvents"}},{"kind":"Field","name":{"kind":"Name","value":"dayLabel"}},{"kind":"Field","name":{"kind":"Name","value":"assignments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"activityCode"}},{"kind":"Field","name":{"kind":"Name","value":"eventName"}},{"kind":"Field","name":{"kind":"Name","value":"roundNumber"}},{"kind":"Field","name":{"kind":"Name","value":"groupNumber"}},{"kind":"Field","name":{"kind":"Name","value":"assignmentCode"}},{"kind":"Field","name":{"kind":"Name","value":"startTime"}},{"kind":"Field","name":{"kind":"Name","value":"endTime"}},{"kind":"Field","name":{"kind":"Name","value":"stationNumber"}},{"kind":"Field","name":{"kind":"Name","value":"roomName"}},{"kind":"Field","name":{"kind":"Name","value":"chance"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personalBests"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"eventId"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"best"}},{"kind":"Field","name":{"kind":"Name","value":"worldRanking"}},{"kind":"Field","name":{"kind":"Name","value":"continentalRanking"}},{"kind":"Field","name":{"kind":"Name","value":"nationalRanking"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"events"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"eventId"}},{"kind":"Field","name":{"kind":"Name","value":"eventName"}},{"kind":"Field","name":{"kind":"Name","value":"dayLabel"}},{"kind":"Field","name":{"kind":"Name","value":"rounds"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"roundNumber"}},{"kind":"Field","name":{"kind":"Name","value":"format"}},{"kind":"Field","name":{"kind":"Name","value":"timeLimit"}},{"kind":"Field","name":{"kind":"Name","value":"cutoff"}},{"kind":"Field","name":{"kind":"Name","value":"cutoffAttempts"}},{"kind":"Field","name":{"kind":"Name","value":"advancementType"}},{"kind":"Field","name":{"kind":"Name","value":"advancementLevel"}},{"kind":"Field","name":{"kind":"Name","value":"dualChance"}},{"kind":"Field","name":{"kind":"Name","value":"groups"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"groupNumber"}},{"kind":"Field","name":{"kind":"Name","value":"activityCode"}},{"kind":"Field","name":{"kind":"Name","value":"startTime"}},{"kind":"Field","name":{"kind":"Name","value":"endTime"}},{"kind":"Field","name":{"kind":"Name","value":"chance"}},{"kind":"Field","name":{"kind":"Name","value":"competitors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"wcaId"}},{"kind":"Field","name":{"kind":"Name","value":"registrantId"}},{"kind":"Field","name":{"kind":"Name","value":"assignmentCode"}},{"kind":"Field","name":{"kind":"Name","value":"seedResult"}}]}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"schedule"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"assignments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"activityCode"}},{"kind":"Field","name":{"kind":"Name","value":"eventName"}},{"kind":"Field","name":{"kind":"Name","value":"roundNumber"}},{"kind":"Field","name":{"kind":"Name","value":"groupNumber"}},{"kind":"Field","name":{"kind":"Name","value":"assignmentCode"}},{"kind":"Field","name":{"kind":"Name","value":"startTime"}},{"kind":"Field","name":{"kind":"Name","value":"endTime"}},{"kind":"Field","name":{"kind":"Name","value":"roomName"}},{"kind":"Field","name":{"kind":"Name","value":"roomColor"}},{"kind":"Field","name":{"kind":"Name","value":"venueName"}},{"kind":"Field","name":{"kind":"Name","value":"stationNumber"}},{"kind":"Field","name":{"kind":"Name","value":"chance"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"allPersonalBests"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"wcaId"}},{"kind":"Field","name":{"kind":"Name","value":"registrantId"}},{"kind":"Field","name":{"kind":"Name","value":"eventId"}},{"kind":"Field","name":{"kind":"Name","value":"single"}},{"kind":"Field","name":{"kind":"Name","value":"average"}},{"kind":"Field","name":{"kind":"Name","value":"singleWorldRank"}},{"kind":"Field","name":{"kind":"Name","value":"averageWorldRank"}}]}},{"kind":"Field","name":{"kind":"Name","value":"wcaLiveCompId"}},{"kind":"Field","name":{"kind":"Name","value":"wcaLiveCompetitors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"wcaId"}},{"kind":"Field","name":{"kind":"Name","value":"liveId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"wcaLiveRoundMap"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"activityCode"}},{"kind":"Field","name":{"kind":"Name","value":"liveRoundId"}}]}},{"kind":"Field","name":{"kind":"Name","value":"info"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"venues"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"address"}},{"kind":"Field","name":{"kind":"Name","value":"city"}}]}},{"kind":"Field","name":{"kind":"Name","value":"organizers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"wcaId"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}},{"kind":"Field","name":{"kind":"Name","value":"delegates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"wcaId"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}},{"kind":"Field","name":{"kind":"Name","value":"wcaUrl"}}]}}]}}]}}]} as unknown as DocumentNode<WcaCompetitionDetailQuery, WcaCompetitionDetailQueryVariables>;
export const WcaLiveCompetitionOverviewDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"wcaLiveCompetitionOverview"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"WcaLiveOverviewInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"wcaLiveCompetitionOverview"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"compId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"events"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"eventId"}},{"kind":"Field","name":{"kind":"Name","value":"eventName"}},{"kind":"Field","name":{"kind":"Name","value":"rounds"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"liveRoundId"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"open"}},{"kind":"Field","name":{"kind":"Name","value":"finished"}},{"kind":"Field","name":{"kind":"Name","value":"active"}},{"kind":"Field","name":{"kind":"Name","value":"numEntered"}},{"kind":"Field","name":{"kind":"Name","value":"numResults"}},{"kind":"Field","name":{"kind":"Name","value":"format"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"numberOfAttempts"}},{"kind":"Field","name":{"kind":"Name","value":"sortBy"}}]}},{"kind":"Field","name":{"kind":"Name","value":"timeLimit"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"centiseconds"}},{"kind":"Field","name":{"kind":"Name","value":"cumulativeRoundWcifIds"}}]}},{"kind":"Field","name":{"kind":"Name","value":"cutoff"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"attemptResult"}},{"kind":"Field","name":{"kind":"Name","value":"numberOfAttempts"}}]}},{"kind":"Field","name":{"kind":"Name","value":"advancementCondition"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"level"}}]}},{"kind":"Field","name":{"kind":"Name","value":"dayIndex"}},{"kind":"Field","name":{"kind":"Name","value":"dayLabel"}},{"kind":"Field","name":{"kind":"Name","value":"isFinal"}},{"kind":"Field","name":{"kind":"Name","value":"dualChance"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"schedule"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"rooms"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"color"}},{"kind":"Field","name":{"kind":"Name","value":"activities"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"activityId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"activityCode"}},{"kind":"Field","name":{"kind":"Name","value":"startTime"}},{"kind":"Field","name":{"kind":"Name","value":"endTime"}},{"kind":"Field","name":{"kind":"Name","value":"dayIndex"}},{"kind":"Field","name":{"kind":"Name","value":"dayLabel"}},{"kind":"Field","name":{"kind":"Name","value":"roundNumber"}},{"kind":"Field","name":{"kind":"Name","value":"isFinal"}},{"kind":"Field","name":{"kind":"Name","value":"chance"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"records"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"tag"}},{"kind":"Field","name":{"kind":"Name","value":"eventId"}},{"kind":"Field","name":{"kind":"Name","value":"eventName"}},{"kind":"Field","name":{"kind":"Name","value":"attemptResult"}},{"kind":"Field","name":{"kind":"Name","value":"personName"}},{"kind":"Field","name":{"kind":"Name","value":"personCountryIso2"}},{"kind":"Field","name":{"kind":"Name","value":"roundNumber"}}]}},{"kind":"Field","name":{"kind":"Name","value":"podiums"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"eventId"}},{"kind":"Field","name":{"kind":"Name","value":"eventName"}},{"kind":"Field","name":{"kind":"Name","value":"sortBy"}},{"kind":"Field","name":{"kind":"Name","value":"entries"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ranking"}},{"kind":"Field","name":{"kind":"Name","value":"personName"}},{"kind":"Field","name":{"kind":"Name","value":"personCountryIso2"}},{"kind":"Field","name":{"kind":"Name","value":"best"}},{"kind":"Field","name":{"kind":"Name","value":"average"}},{"kind":"Field","name":{"kind":"Name","value":"singleRecordTag"}},{"kind":"Field","name":{"kind":"Name","value":"averageRecordTag"}}]}}]}}]}}]}}]} as unknown as DocumentNode<WcaLiveCompetitionOverviewQuery, WcaLiveCompetitionOverviewQueryVariables>;
export const WcaLiveRoundResultsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"wcaLiveRoundResults"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"WcaLiveRoundInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"wcaLiveRoundResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"roundActivityCode"}},{"kind":"Field","name":{"kind":"Name","value":"roundName"}},{"kind":"Field","name":{"kind":"Name","value":"active"}},{"kind":"Field","name":{"kind":"Name","value":"finished"}},{"kind":"Field","name":{"kind":"Name","value":"numberOfAttempts"}},{"kind":"Field","name":{"kind":"Name","value":"sortBy"}},{"kind":"Field","name":{"kind":"Name","value":"dualChance"}},{"kind":"Field","name":{"kind":"Name","value":"results"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ranking"}},{"kind":"Field","name":{"kind":"Name","value":"best"}},{"kind":"Field","name":{"kind":"Name","value":"average"}},{"kind":"Field","name":{"kind":"Name","value":"attempts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"result"}}]}},{"kind":"Field","name":{"kind":"Name","value":"personName"}},{"kind":"Field","name":{"kind":"Name","value":"personWcaId"}},{"kind":"Field","name":{"kind":"Name","value":"personCountryIso2"}},{"kind":"Field","name":{"kind":"Name","value":"personLiveId"}},{"kind":"Field","name":{"kind":"Name","value":"singleRecordTag"}},{"kind":"Field","name":{"kind":"Name","value":"averageRecordTag"}},{"kind":"Field","name":{"kind":"Name","value":"advancing"}},{"kind":"Field","name":{"kind":"Name","value":"advancingQuestionable"}},{"kind":"Field","name":{"kind":"Name","value":"chances"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"chance"}},{"kind":"Field","name":{"kind":"Name","value":"attempts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"result"}}]}},{"kind":"Field","name":{"kind":"Name","value":"best"}},{"kind":"Field","name":{"kind":"Name","value":"average"}},{"kind":"Field","name":{"kind":"Name","value":"noShow"}},{"kind":"Field","name":{"kind":"Name","value":"counting"}}]}}]}}]}}]}}]} as unknown as DocumentNode<WcaLiveRoundResultsQuery, WcaLiveRoundResultsQueryVariables>;
export const WcaLiveCompetitorResultsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"wcaLiveCompetitorResults"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"WcaLiveCompetitorInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"wcaLiveCompetitorResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"personName"}},{"kind":"Field","name":{"kind":"Name","value":"personWcaId"}},{"kind":"Field","name":{"kind":"Name","value":"personCountryIso2"}},{"kind":"Field","name":{"kind":"Name","value":"results"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"eventId"}},{"kind":"Field","name":{"kind":"Name","value":"eventName"}},{"kind":"Field","name":{"kind":"Name","value":"roundNumber"}},{"kind":"Field","name":{"kind":"Name","value":"roundName"}},{"kind":"Field","name":{"kind":"Name","value":"ranking"}},{"kind":"Field","name":{"kind":"Name","value":"best"}},{"kind":"Field","name":{"kind":"Name","value":"average"}},{"kind":"Field","name":{"kind":"Name","value":"attempts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"result"}}]}},{"kind":"Field","name":{"kind":"Name","value":"singleRecordTag"}},{"kind":"Field","name":{"kind":"Name","value":"averageRecordTag"}},{"kind":"Field","name":{"kind":"Name","value":"advancing"}},{"kind":"Field","name":{"kind":"Name","value":"advancingQuestionable"}},{"kind":"Field","name":{"kind":"Name","value":"format"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"numberOfAttempts"}},{"kind":"Field","name":{"kind":"Name","value":"sortBy"}}]}}]}}]}}]}}]} as unknown as DocumentNode<WcaLiveCompetitorResultsQuery, WcaLiveCompetitorResultsQueryVariables>;
export const AdminTrainerAlternativesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"adminTrainerAlternatives"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"category"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"page"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pageSize"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"adminTrainerAlternatives"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"category"},"value":{"kind":"Variable","name":{"kind":"Name","value":"category"}}},{"kind":"Argument","name":{"kind":"Name","value":"page"},"value":{"kind":"Variable","name":{"kind":"Name","value":"page"}}},{"kind":"Argument","name":{"kind":"Name","value":"pageSize"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pageSize"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"subset"}},{"kind":"Field","name":{"kind":"Name","value":"case_name"}},{"kind":"Field","name":{"kind":"Name","value":"algorithm"}},{"kind":"Field","name":{"kind":"Name","value":"original_input"}},{"kind":"Field","name":{"kind":"Name","value":"user_id"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"hasMore"}}]}}]}}]} as unknown as DocumentNode<AdminTrainerAlternativesQuery, AdminTrainerAlternativesQueryVariables>;
export const LandingStatsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"landingStats"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"landingStats"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"upcoming_wca_competition_count"}},{"kind":"Field","name":{"kind":"Name","value":"total_competitor_capacity"}},{"kind":"Field","name":{"kind":"Name","value":"supported_event_count"}},{"kind":"Field","name":{"kind":"Name","value":"supported_language_count"}},{"kind":"Field","name":{"kind":"Name","value":"cuber_count"}},{"kind":"Field","name":{"kind":"Name","value":"solve_count"}}]}}]}}]} as unknown as DocumentNode<LandingStatsQuery, LandingStatsQueryVariables>;
export const MyCompetitionFollowsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"myCompetitionFollows"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"competitionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"myCompetitionFollows"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"competitionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"competitionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"competition_id"}},{"kind":"Field","name":{"kind":"Name","value":"followed_registrant_id"}},{"kind":"Field","name":{"kind":"Name","value":"followed_wca_id"}},{"kind":"Field","name":{"kind":"Name","value":"followed_name"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}}]}}]} as unknown as DocumentNode<MyCompetitionFollowsQuery, MyCompetitionFollowsQueryVariables>;
export const CaseStatsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"caseStats"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"type"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"cubeType"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"subset"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"lastN"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"caseStats"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"type"},"value":{"kind":"Variable","name":{"kind":"Name","value":"type"}}},{"kind":"Argument","name":{"kind":"Name","value":"cubeType"},"value":{"kind":"Variable","name":{"kind":"Name","value":"cubeType"}}},{"kind":"Argument","name":{"kind":"Name","value":"subset"},"value":{"kind":"Variable","name":{"kind":"Name","value":"subset"}}},{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"lastN"},"value":{"kind":"Variable","name":{"kind":"Name","value":"lastN"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"caseKey"}},{"kind":"Field","name":{"kind":"Name","value":"caseName"}},{"kind":"Field","name":{"kind":"Name","value":"caseType"}},{"kind":"Field","name":{"kind":"Name","value":"count"}},{"kind":"Field","name":{"kind":"Name","value":"averageTime"}},{"kind":"Field","name":{"kind":"Name","value":"bestTime"}},{"kind":"Field","name":{"kind":"Name","value":"avgRecognition"}},{"kind":"Field","name":{"kind":"Name","value":"avgExecution"}},{"kind":"Field","name":{"kind":"Name","value":"avgTps"}},{"kind":"Field","name":{"kind":"Name","value":"avgTurns"}},{"kind":"Field","name":{"kind":"Name","value":"lastSeenAt"}}]}}]}}]} as unknown as DocumentNode<CaseStatsQuery, CaseStatsQueryVariables>;
export const AdminActiveUsersDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"adminActiveUsers"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"period"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"monthYear"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"adminActiveUsers"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"period"},"value":{"kind":"Variable","name":{"kind":"Name","value":"period"}}},{"kind":"Argument","name":{"kind":"Name","value":"monthYear"},"value":{"kind":"Variable","name":{"kind":"Name","value":"monthYear"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rows"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"active_minutes"}},{"kind":"Field","name":{"kind":"Name","value":"last_seen_at"}}]}},{"kind":"Field","name":{"kind":"Name","value":"total_active_users"}},{"kind":"Field","name":{"kind":"Name","value":"total_active_minutes"}},{"kind":"Field","name":{"kind":"Name","value":"available_months"}}]}}]}},...PublicUserFragmentFragmentDoc.definitions,...ImageFragmentFragmentDoc.definitions]} as unknown as DocumentNode<AdminActiveUsersQuery, AdminActiveUsersQueryVariables>;
export const ConversationsDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"conversations"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"page"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"requests"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"conversations"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"page"},"value":{"kind":"Variable","name":{"kind":"Name","value":"page"}}},{"kind":"Argument","name":{"kind":"Name","value":"requests"},"value":{"kind":"Variable","name":{"kind":"Name","value":"requests"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"conversations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ConversationViewFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"more_results"}}]}}]}},...ConversationViewFragmentFragmentDoc.definitions,...PublicUserFragmentFragmentDoc.definitions,...ImageFragmentFragmentDoc.definitions,...MessageFragmentFragmentDoc.definitions,...DmSolveFragmentFragmentDoc.definitions]} as unknown as DocumentNode<ConversationsQuery, ConversationsQueryVariables>;
export const DmMessagesDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"dmMessages"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"conversationId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"before"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"DateTime"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"messages"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"conversationId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"conversationId"}}},{"kind":"Argument","name":{"kind":"Name","value":"before"},"value":{"kind":"Variable","name":{"kind":"Name","value":"before"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"messages"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MessageFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"more_results"}},{"kind":"Field","name":{"kind":"Name","value":"accepted"}},{"kind":"Field","name":{"kind":"Name","value":"awaiting_accept"}},{"kind":"Field","name":{"kind":"Name","value":"muted"}}]}}]}},...MessageFragmentFragmentDoc.definitions,...PublicUserFragmentFragmentDoc.definitions,...ImageFragmentFragmentDoc.definitions,...DmSolveFragmentFragmentDoc.definitions]} as unknown as DocumentNode<DmMessagesQuery, DmMessagesQueryVariables>;
export const DmPresenceDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"dmPresence"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userIds"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"dmPresence"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"userIds"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userIds"}}}]}]}}]} as unknown as DocumentNode<DmPresenceQuery, DmPresenceQueryVariables>;
export const InboxSummaryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"inboxSummary"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"inboxSummary"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"unread_total"}},{"kind":"Field","name":{"kind":"Name","value":"request_count"}}]}}]}}]} as unknown as DocumentNode<InboxSummaryQuery, InboxSummaryQueryVariables>;
export const MessageReportsDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"messageReports"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"status"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ReportStatus"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"page"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"messageReports"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"status"},"value":{"kind":"Variable","name":{"kind":"Name","value":"status"}}},{"kind":"Argument","name":{"kind":"Name","value":"page"},"value":{"kind":"Variable","name":{"kind":"Name","value":"page"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"open_count"}},{"kind":"Field","name":{"kind":"Name","value":"more_results"}},{"kind":"Field","name":{"kind":"Name","value":"reports"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"moderator_note"}},{"kind":"Field","name":{"kind":"Name","value":"reviewed_at"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"reporter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"reported"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"reviewed_by"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"snapshot"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"sender_id"}},{"kind":"Field","name":{"kind":"Name","value":"sender_username"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"has_solve"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}}]}}]}}]}},...PublicUserFragmentFragmentDoc.definitions,...ImageFragmentFragmentDoc.definitions]} as unknown as DocumentNode<MessageReportsQuery, MessageReportsQueryVariables>;
export const SocialPreferenceDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"socialPreference"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"socialPreference"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"dm_policy"}},{"kind":"Field","name":{"kind":"Name","value":"read_receipts"}},{"kind":"Field","name":{"kind":"Name","value":"typing_indicator"}},{"kind":"Field","name":{"kind":"Name","value":"online_status"}},{"kind":"Field","name":{"kind":"Name","value":"searchable"}},{"kind":"Field","name":{"kind":"Name","value":"dm_push"}}]}}]}}]} as unknown as DocumentNode<SocialPreferenceQuery, SocialPreferenceQueryVariables>;
export const BlockedUsersDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"blockedUsers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"blockedUsers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserFragment"}}]}}]}}]}},...PublicUserFragmentFragmentDoc.definitions,...ImageFragmentFragmentDoc.definitions]} as unknown as DocumentNode<BlockedUsersQuery, BlockedUsersQueryVariables>;
export const MessageRecipientSearchDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"messageRecipientSearch"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"query"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"messageRecipientSearch"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"query"},"value":{"kind":"Variable","name":{"kind":"Name","value":"query"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicUserFragment"}}]}}]}},...PublicUserFragmentFragmentDoc.definitions,...ImageFragmentFragmentDoc.definitions]} as unknown as DocumentNode<MessageRecipientSearchQuery, MessageRecipientSearchQueryVariables>;
export const SmartCubeTelemetrySummaryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SmartCubeTelemetrySummary"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"days"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"smartCubeTelemetrySummary"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"days"},"value":{"kind":"Variable","name":{"kind":"Name","value":"days"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cube_type"}},{"kind":"Field","name":{"kind":"Name","value":"device_name"}},{"kind":"Field","name":{"kind":"Name","value":"solves"}},{"kind":"Field","name":{"kind":"Name","value":"distinct_users"}},{"kind":"Field","name":{"kind":"Name","value":"via_tracker"}},{"kind":"Field","name":{"kind":"Name","value":"via_grace"}},{"kind":"Field","name":{"kind":"Name","value":"via_poll"}},{"kind":"Field","name":{"kind":"Name","value":"out_of_sync_events"}},{"kind":"Field","name":{"kind":"Name","value":"late_scramble_events"}},{"kind":"Field","name":{"kind":"Name","value":"scramble_realign_events"}},{"kind":"Field","name":{"kind":"Name","value":"scramble_reset_events"}},{"kind":"Field","name":{"kind":"Name","value":"median_lag_ms"}},{"kind":"Field","name":{"kind":"Name","value":"p95_lag_ms"}},{"kind":"Field","name":{"kind":"Name","value":"avg_battery_clean"}},{"kind":"Field","name":{"kind":"Name","value":"avg_battery_recovered"}},{"kind":"Field","name":{"kind":"Name","value":"median_time_correction_ms"}},{"kind":"Field","name":{"kind":"Name","value":"avg_recovered_moves"}}]}}]}}]} as unknown as DocumentNode<SmartCubeTelemetrySummaryQuery, SmartCubeTelemetrySummaryQueryVariables>;
export const MagnetTelemetrySummaryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MagnetTelemetrySummary"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"days"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"magnetTelemetrySummary"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"days"},"value":{"kind":"Variable","name":{"kind":"Name","value":"days"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"platform"}},{"kind":"Field","name":{"kind":"Name","value":"device_model"}},{"kind":"Field","name":{"kind":"Name","value":"cube_puzzle"}},{"kind":"Field","name":{"kind":"Name","value":"median_near_min_ut"}},{"kind":"Field","name":{"kind":"Name","value":"sensor_name"}},{"kind":"Field","name":{"kind":"Name","value":"distinct_users"}},{"kind":"Field","name":{"kind":"Name","value":"placements"}},{"kind":"Field","name":{"kind":"Name","value":"min_near_ut"}},{"kind":"Field","name":{"kind":"Name","value":"median_near_ut"}},{"kind":"Field","name":{"kind":"Name","value":"lifts"}},{"kind":"Field","name":{"kind":"Name","value":"started"}},{"kind":"Field","name":{"kind":"Name","value":"refused"}},{"kind":"Field","name":{"kind":"Name","value":"median_latency_ms"}},{"kind":"Field","name":{"kind":"Name","value":"p95_latency_ms"}},{"kind":"Field","name":{"kind":"Name","value":"median_approach_ms"}},{"kind":"Field","name":{"kind":"Name","value":"rejects"}},{"kind":"Field","name":{"kind":"Name","value":"unsupported"}},{"kind":"Field","name":{"kind":"Name","value":"unknown_hints"}},{"kind":"Field","name":{"kind":"Name","value":"median_sigma"}},{"kind":"Field","name":{"kind":"Name","value":"rate_hz"}}]}}]}}]} as unknown as DocumentNode<MagnetTelemetrySummaryQuery, MagnetTelemetrySummaryQueryVariables>;
export const MagnetTelemetryRowsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MagnetTelemetryRows"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"offset"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"username"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"eventType"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"deviceModel"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"newestFirst"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"magnetTelemetryRows"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}},{"kind":"Argument","name":{"kind":"Name","value":"offset"},"value":{"kind":"Variable","name":{"kind":"Name","value":"offset"}}},{"kind":"Argument","name":{"kind":"Name","value":"username"},"value":{"kind":"Variable","name":{"kind":"Name","value":"username"}}},{"kind":"Argument","name":{"kind":"Name","value":"eventType"},"value":{"kind":"Variable","name":{"kind":"Name","value":"eventType"}}},{"kind":"Argument","name":{"kind":"Name","value":"deviceModel"},"value":{"kind":"Variable","name":{"kind":"Name","value":"deviceModel"}}},{"kind":"Argument","name":{"kind":"Name","value":"newestFirst"},"value":{"kind":"Variable","name":{"kind":"Name","value":"newestFirst"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"platform"}},{"kind":"Field","name":{"kind":"Name","value":"device_model"}},{"kind":"Field","name":{"kind":"Name","value":"os_version"}},{"kind":"Field","name":{"kind":"Name","value":"sensor_name"}},{"kind":"Field","name":{"kind":"Name","value":"event_type"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"delta_ut"}},{"kind":"Field","name":{"kind":"Name","value":"latency_ms"}},{"kind":"Field","name":{"kind":"Name","value":"rest_ms"}},{"kind":"Field","name":{"kind":"Name","value":"approach_ms"}},{"kind":"Field","name":{"kind":"Name","value":"sigma"}},{"kind":"Field","name":{"kind":"Name","value":"rate_hz"}},{"kind":"Field","name":{"kind":"Name","value":"reversed"}},{"kind":"Field","name":{"kind":"Name","value":"has_samples"}},{"kind":"Field","name":{"kind":"Name","value":"app_version"}},{"kind":"Field","name":{"kind":"Name","value":"cube_puzzle"}},{"kind":"Field","name":{"kind":"Name","value":"near_min_ut"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}}]}}]} as unknown as DocumentNode<MagnetTelemetryRowsQuery, MagnetTelemetryRowsQueryVariables>;
export const MagnetTelemetrySamplesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MagnetTelemetrySamples"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"magnetTelemetrySamples"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<MagnetTelemetrySamplesQuery, MagnetTelemetrySamplesQueryVariables>;
export const SmartCubeTelemetryRowsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SmartCubeTelemetryRows"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"cubeType"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"offset"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"username"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"eventType"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"newestFirst"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"smartCubeTelemetryRows"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}},{"kind":"Argument","name":{"kind":"Name","value":"cubeType"},"value":{"kind":"Variable","name":{"kind":"Name","value":"cubeType"}}},{"kind":"Argument","name":{"kind":"Name","value":"offset"},"value":{"kind":"Variable","name":{"kind":"Name","value":"offset"}}},{"kind":"Argument","name":{"kind":"Name","value":"username"},"value":{"kind":"Variable","name":{"kind":"Name","value":"username"}}},{"kind":"Argument","name":{"kind":"Name","value":"eventType"},"value":{"kind":"Variable","name":{"kind":"Name","value":"eventType"}}},{"kind":"Argument","name":{"kind":"Name","value":"newestFirst"},"value":{"kind":"Variable","name":{"kind":"Name","value":"newestFirst"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"device_name"}},{"kind":"Field","name":{"kind":"Name","value":"cube_type"}},{"kind":"Field","name":{"kind":"Name","value":"surface"}},{"kind":"Field","name":{"kind":"Name","value":"event_type"}},{"kind":"Field","name":{"kind":"Name","value":"detection_source"}},{"kind":"Field","name":{"kind":"Name","value":"detection_lag_ms"}},{"kind":"Field","name":{"kind":"Name","value":"time_ms"}},{"kind":"Field","name":{"kind":"Name","value":"turn_count"}},{"kind":"Field","name":{"kind":"Name","value":"battery_level"}},{"kind":"Field","name":{"kind":"Name","value":"time_correction_ms"}},{"kind":"Field","name":{"kind":"Name","value":"recovered_moves"}},{"kind":"Field","name":{"kind":"Name","value":"is_native"}},{"kind":"Field","name":{"kind":"Name","value":"app_version"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}}]}}]}}]} as unknown as DocumentNode<SmartCubeTelemetryRowsQuery, SmartCubeTelemetryRowsQueryVariables>;
export const ZktPersonBestsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"zktPersonBests"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"zktId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"zktPersonBests"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"zktId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"zktId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"event_id"}},{"kind":"Field","name":{"kind":"Name","value":"single"}},{"kind":"Field","name":{"kind":"Name","value":"average"}}]}}]}}]} as unknown as DocumentNode<ZktPersonBestsQuery, ZktPersonBestsQueryVariables>;
export const RegistrationWatchAccessDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"registrationWatchAccess"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"registrationWatchAccess"}}]}}]} as unknown as DocumentNode<RegistrationWatchAccessQuery, RegistrationWatchAccessQueryVariables>;
export const RegistrationWatchCompetitionsDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"registrationWatchCompetitions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"registrationWatchCompetitions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"RegistrationWatchCompetitionFragment"}}]}}]}},...RegistrationWatchCompetitionFragmentFragmentDoc.definitions]} as unknown as DocumentNode<RegistrationWatchCompetitionsQuery, RegistrationWatchCompetitionsQueryVariables>;
export const RegistrationWatchCompetitionDocument = {"kind":"Document", "definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"registrationWatchCompetition"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"competitionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"registrationWatchCompetition"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"competitionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"competitionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"competition"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"RegistrationWatchCompetitionFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"events"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"wca_registration_id"}},{"kind":"Field","name":{"kind":"Name","value":"registrant_id"}},{"kind":"Field","name":{"kind":"Name","value":"wca_id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"events_before"}},{"kind":"Field","name":{"kind":"Name","value":"events_after"}},{"kind":"Field","name":{"kind":"Name","value":"after_close"}},{"kind":"Field","name":{"kind":"Name","value":"after_groups"}},{"kind":"Field","name":{"kind":"Name","value":"window_start"}},{"kind":"Field","name":{"kind":"Name","value":"observed_at"}}]}},{"kind":"Field","name":{"kind":"Name","value":"registrants"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"wca_registration_id"}},{"kind":"Field","name":{"kind":"Name","value":"registrant_id"}},{"kind":"Field","name":{"kind":"Name","value":"wca_id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"event_ids"}},{"kind":"Field","name":{"kind":"Name","value":"competitor_groups"}},{"kind":"Field","name":{"kind":"Name","value":"staff_tasks"}},{"kind":"Field","name":{"kind":"Name","value":"unstaffed"}},{"kind":"Field","name":{"kind":"Name","value":"first_seen_at"}}]}}]}}]}},...RegistrationWatchCompetitionFragmentFragmentDoc.definitions]} as unknown as DocumentNode<RegistrationWatchCompetitionQuery, RegistrationWatchCompetitionQueryVariables>;