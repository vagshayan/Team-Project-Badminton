import React from 'react';
import {
  ArrowLeft, ArrowRight, Bell as BellIcon, Building2, CalendarDays, Camera as CameraIcon,
  Check, ChevronDown, ChevronUp, CircleAlert, CircleCheck, CircleDot, Cloud as CloudIcon,
  Clipboard, Clock as ClockIcon, Crown as CrownIcon, Eye as EyeIcon, EyeOff, FileDown,
  Folder as FolderIcon, Gem, GitBranch, Globe, GraduationCap, Hourglass as HourglassIcon,
  IdCard as IdCardIcon, KeyRound, LockKeyhole, LogOut, Mail, MapPin, Medal as MedalIcon,
  Menu, Moon as MoonIcon, Pencil, Phone as PhoneIcon, RotateCcw, Search as SearchIcon,
  Shield as ShieldIcon, Shirt, Star as StarIcon, Sun as SunIcon, Table2, Target as TargetIcon, TriangleAlert,
  Trash2, TreeDeciduous, Trophy as TrophyIcon, UserRound, UsersRound, X, Zap,
} from 'lucide-react';

const icon = (Icon) => React.createElement(Icon, {
  size: '1em',
  strokeWidth: 1.8,
  'aria-hidden': true,
  style: { display: 'inline-block', verticalAlign: '-0.125em', flexShrink: 0 },
});

export const SUN = icon(SunIcon);
export const MOON = icon(MoonIcon);
export const BELL = icon(BellIcon);
export const EYE = icon(EyeIcon);
export const LOCK = icon(LockKeyhole);
export const KEY = icon(KeyRound);
export const SEARCH = icon(SearchIcon);
export const LOGOUT = icon(LogOut);
export const MENU_OPEN = icon(Menu);
export const MENU_CLOSE = icon(X);
export const CLOSE = icon(X);
export const CHECK = icon(Check);
export const EYE_OFF = icon(EyeOff);
export const CHECK_MARK = icon(Check);
export const CROSS = icon(X);
export const WARNING = icon(TriangleAlert);
export const WARNING_ROUND = icon(CircleAlert);
export const SUCCESS = icon(CircleCheck);
export const TROPHY = icon(TrophyIcon);
export const TARGET = icon(TargetIcon);
export const TREE = icon(TreeDeciduous);
export const FOLDER = icon(FolderIcon);
export const DIAMOND = icon(Gem);
export const PEOPLE = icon(UsersRound);
export const HOURGLASS = icon(HourglassIcon);
export const MEDAL = icon(MedalIcon);
export const PHONE = icon(PhoneIcon);
export const EMAIL = icon(Mail);
export const ID_CARD = icon(IdCardIcon);
export const LOCATION = icon(MapPin);
export const CLOCK = icon(ClockIcon);
export const CLOCK_3 = icon(ClockIcon);
export const CALENDAR = icon(CalendarDays);
export const SCHEDULE = icon(CalendarDays);
export const CLOUD = icon(CloudIcon);
export const ARROW_RIGHT = icon(ArrowRight);
export const ARROW_LEFT = icon(ArrowLeft);
export const CARET_UP = icon(ChevronUp);
export const CARET_DOWN = icon(ChevronDown);
export const RESET = icon(RotateCcw);
export const PUBLISH = icon(Globe);
export const PDF = icon(FileDown);
export const SHIELD = icon(ShieldIcon);
export const TRASH = icon(Trash2);
export const LIGHTNING = icon(Zap);
export const CLIPBOARD = icon(Clipboard);
export const STADIUM = icon(Building2);
export const BADMINTON = icon(TrophyIcon);
export const TABLE_TENNIS = icon(Table2);
export const CARROM = icon(CircleDot);
export const USER_ROUND = icon(UserRound);
export const USERS_ROUND = icon(UsersRound);
export const GRADUATION_CAP = icon(GraduationCap);
export const CROWN = icon(CrownIcon);
export const STAR = icon(StarIcon);
export const SHIRT_ICON = icon(Shirt);
export const CAMERA = icon(CameraIcon);
export const PENCIL = icon(Pencil);
export const DOWNLOAD = icon(FileDown);

export default {
  SUN,
  MOON,
  BELL,
  EYE,
  LOCK,
  KEY,
  SEARCH,
  LOGOUT,
  MENU_OPEN,
  MENU_CLOSE,
  CLOSE,
  CHECK,
  CHECK_MARK,
  CROSS,
  WARNING,
  WARNING_ROUND,
  TROPHY,
  TARGET,
  TREE,
  FOLDER,
  DIAMOND,
  PEOPLE,
  HOURGLASS,
  MEDAL,
  PHONE,
  EMAIL,
  ID_CARD,
  LOCATION,
  CLOCK,
  CLOCK_3,
  CALENDAR,
  CLOUD,
  ARROW_RIGHT,
  ARROW_LEFT,
  CARET_UP,
  CARET_DOWN,
  RESET,
  PUBLISH,
  PDF,
  SHIELD,
  LIGHTNING,
  CLIPBOARD,
  STADIUM,
  SUCCESS,
  SCHEDULE,
  TRASH,
  USER_ROUND,
  USERS_ROUND,
  GRADUATION_CAP,
  CROWN,
  STAR,
  SHIRT_ICON,
  CAMERA,
  PENCIL,
  DOWNLOAD,
};
