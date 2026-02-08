import {
  ActivityIcon,
  AlertTriangleIcon,
  AppWindowIcon,
  ArchiveIcon,
  ArrowDownIcon,
  ArrowLeftCircleIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  ArrowUpRightIcon,
  AudioLinesIcon,
  BadgeCheck,
  BadgeCheckIcon,
  BellIcon,
  BluetoothIcon,
  BoldIcon,
  BookmarkIcon,
  BookOpen,
  BotIcon,
  Building2Icon,
  CalculatorIcon,
  CalendarIcon,
  CaptionsIcon,
  ChartBarIcon,
  ChartLineIcon,
  ChartPieIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  ChevronUpIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleIcon,
  ClipboardPasteIcon,
  Clock2Icon,
  CodeIcon,
  CopyIcon,
  CreditCardIcon,
  DownloadIcon,
  ExternalLinkIcon,
  EyeIcon,
  EyeOffIcon,
  FileCodeIcon,
  FileIcon,
  FileTextIcon,
  FlipHorizontalIcon,
  FlipVerticalIcon,
  FolderIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  FolderSearchIcon,
  FrameIcon,
  GlobeIcon,
  HeartIcon,
  HelpCircleIcon,
  HomeIcon,
  ImageIcon,
  InboxIcon,
  InfoIcon,
  ItalicIcon,
  KeyboardIcon,
  LanguagesIcon,
  LayoutGridIcon,
  LayoutIcon,
  LifeBuoy,
  LinkIcon,
  ListIcon,
  Loader2Icon,
  LogOutIcon,
  MailIcon,
  MapIcon,
  MaximizeIcon,
  MessageSquareIcon,
  MicIcon,
  MinimizeIcon,
  MinusIcon,
  MonitorIcon,
  MoonIcon,
  MoreHorizontalIcon,
  MoreVerticalIcon,
  OctagonXIcon,
  PaletteIcon,
  PanelLeftIcon,
  PencilIcon,
  PieChartIcon,
  PlusIcon,
  RadioIcon,
  RefreshCwIcon,
  RotateCwIcon,
  SaveIcon,
  ScissorsIcon,
  SearchIcon,
  Send,
  Settings2Icon,
  SettingsIcon,
  ShareIcon,
  ShieldIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  SmileIcon,
  SparklesIcon,
  StarIcon,
  SunIcon,
  TableIcon,
  TerminalSquareIcon,
  Trash2Icon,
  TrashIcon,
  TrendingUpIcon,
  TriangleAlertIcon,
  UnderlineIcon,
  UserIcon,
  UserRoundXIcon,
  VolumeOffIcon,
  WalletIcon,
  XIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from 'lucide-react'

const ICON_LIBRARY_NAME = [
  'lucide',
  'tabler',
  'hugeicons',
  'phosphor',
  'remixicon',
] as const
type IconLibraryName = (typeof ICON_LIBRARY_NAME)[number]

export function IconPlaceholder({
  lucide,
  tabler,
  hugeicons,
  phosphor,
  remixicon,
  ...props
}: {
  [K in IconLibraryName]: string
} & React.ComponentProps<'svg'>) {
  switch (lucide) {
    case 'ActivityIcon':
      return <ActivityIcon {...props} />
    case 'AlertTriangleIcon':
      return <AlertTriangleIcon {...props} />
    case 'AppWindowIcon':
      return <AppWindowIcon {...props} />
    case 'ArchiveIcon':
      return <ArchiveIcon {...props} />
    case 'ArrowDownIcon':
      return <ArrowDownIcon {...props} />
    case 'ArrowLeftCircleIcon':
      return <ArrowLeftCircleIcon {...props} />
    case 'ArrowLeftIcon':
      return <ArrowLeftIcon {...props} />
    case 'ArrowRightIcon':
      return <ArrowRightIcon {...props} />
    case 'ArrowUpIcon':
      return <ArrowUpIcon {...props} />
    case 'ArrowUpRightIcon':
      return <ArrowUpRightIcon {...props} />
    case 'AudioLinesIcon':
      return <AudioLinesIcon {...props} />
    case 'BadgeCheck':
      return <BadgeCheck {...props} />
    case 'BadgeCheckIcon':
      return <BadgeCheckIcon {...props} />
    case 'BellIcon':
      return <BellIcon {...props} />
    case 'BluetoothIcon':
      return <BluetoothIcon {...props} />
    case 'BoldIcon':
      return <BoldIcon {...props} />
    case 'BookmarkIcon':
      return <BookmarkIcon {...props} />
    case 'BookOpen':
      return <BookOpen {...props} />
    case 'BotIcon':
      return <BotIcon {...props} />
    case 'Building2Icon':
      return <Building2Icon {...props} />
    case 'CalculatorIcon':
      return <CalculatorIcon {...props} />
    case 'CalendarIcon':
      return <CalendarIcon {...props} />
    case 'CaptionsIcon':
      return <CaptionsIcon {...props} />
    case 'ChartBarIcon':
      return <ChartBarIcon {...props} />
    case 'ChartLineIcon':
      return <ChartLineIcon {...props} />
    case 'ChartPieIcon':
      return <ChartPieIcon {...props} />
    case 'CheckIcon':
      return <CheckIcon {...props} />
    case 'ChevronDownIcon':
      return <ChevronDownIcon {...props} />
    case 'ChevronLeftIcon':
      return <ChevronLeftIcon {...props} />
    case 'ChevronRightIcon':
      return <ChevronRightIcon {...props} />
    case 'ChevronsUpDownIcon':
      return <ChevronsUpDownIcon {...props} />
    case 'ChevronUpIcon':
      return <ChevronUpIcon {...props} />
    case 'CircleAlertIcon':
      return <CircleAlertIcon {...props} />
    case 'CircleCheckIcon':
      return <CircleCheckIcon {...props} />
    case 'CircleDashedIcon':
      return <CircleDashedIcon {...props} />
    case 'CircleIcon':
      return <CircleIcon {...props} />
    case 'ClipboardPasteIcon':
      return <ClipboardPasteIcon {...props} />
    case 'Clock2Icon':
      return <Clock2Icon {...props} />
    case 'CodeIcon':
      return <CodeIcon {...props} />
    case 'CopyIcon':
      return <CopyIcon {...props} />
    case 'CreditCardIcon':
      return <CreditCardIcon {...props} />
    case 'DownloadIcon':
      return <DownloadIcon {...props} />
    case 'ExternalLinkIcon':
      return <ExternalLinkIcon {...props} />
    case 'EyeIcon':
      return <EyeIcon {...props} />
    case 'EyeOffIcon':
      return <EyeOffIcon {...props} />
    case 'FileCodeIcon':
      return <FileCodeIcon {...props} />
    case 'FileIcon':
      return <FileIcon {...props} />
    case 'FileTextIcon':
      return <FileTextIcon {...props} />
    case 'FlipHorizontalIcon':
      return <FlipHorizontalIcon {...props} />
    case 'FlipVerticalIcon':
      return <FlipVerticalIcon {...props} />
    case 'FolderIcon':
      return <FolderIcon {...props} />
    case 'FolderOpenIcon':
      return <FolderOpenIcon {...props} />
    case 'FolderPlusIcon':
      return <FolderPlusIcon {...props} />
    case 'FolderSearchIcon':
      return <FolderSearchIcon {...props} />
    case 'FrameIcon':
      return <FrameIcon {...props} />
    case 'GlobeIcon':
      return <GlobeIcon {...props} />
    case 'HeartIcon':
      return <HeartIcon {...props} />
    case 'HelpCircleIcon':
      return <HelpCircleIcon {...props} />
    case 'HomeIcon':
      return <HomeIcon {...props} />
    case 'ImageIcon':
      return <ImageIcon {...props} />
    case 'InboxIcon':
      return <InboxIcon {...props} />
    case 'InfoIcon':
      return <InfoIcon {...props} />
    case 'ItalicIcon':
      return <ItalicIcon {...props} />
    case 'KeyboardIcon':
      return <KeyboardIcon {...props} />
    case 'LanguagesIcon':
      return <LanguagesIcon {...props} />
    case 'LayoutGridIcon':
      return <LayoutGridIcon {...props} />
    case 'LayoutIcon':
      return <LayoutIcon {...props} />
    case 'LifeBuoy':
      return <LifeBuoy {...props} />
    case 'LinkIcon':
      return <LinkIcon {...props} />
    case 'ListIcon':
      return <ListIcon {...props} />
    case 'Loader2Icon':
      return <Loader2Icon {...props} />
    case 'LogOutIcon':
      return <LogOutIcon {...props} />
    case 'MailIcon':
      return <MailIcon {...props} />
    case 'MapIcon':
      return <MapIcon {...props} />
    case 'MaximizeIcon':
      return <MaximizeIcon {...props} />
    case 'MessageSquareIcon':
      return <MessageSquareIcon {...props} />
    case 'MicIcon':
      return <MicIcon {...props} />
    case 'MinimizeIcon':
      return <MinimizeIcon {...props} />
    case 'MinusIcon':
      return <MinusIcon {...props} />
    case 'MonitorIcon':
      return <MonitorIcon {...props} />
    case 'MoonIcon':
      return <MoonIcon {...props} />
    case 'MoreHorizontalIcon':
      return <MoreHorizontalIcon {...props} />
    case 'MoreVerticalIcon':
      return <MoreVerticalIcon {...props} />
    case 'OctagonXIcon':
      return <OctagonXIcon {...props} />
    case 'PaletteIcon':
      return <PaletteIcon {...props} />
    case 'PanelLeftIcon':
      return <PanelLeftIcon {...props} />
    case 'PencilIcon':
      return <PencilIcon {...props} />
    case 'PieChartIcon':
      return <PieChartIcon {...props} />
    case 'PlusIcon':
      return <PlusIcon {...props} />
    case 'RadioIcon':
      return <RadioIcon {...props} />
    case 'RefreshCwIcon':
      return <RefreshCwIcon {...props} />
    case 'RotateCwIcon':
      return <RotateCwIcon {...props} />
    case 'SaveIcon':
      return <SaveIcon {...props} />
    case 'ScissorsIcon':
      return <ScissorsIcon {...props} />
    case 'SearchIcon':
      return <SearchIcon {...props} />
    case 'Send':
      return <Send {...props} />
    case 'Settings2Icon':
      return <Settings2Icon {...props} />
    case 'SettingsIcon':
      return <SettingsIcon {...props} />
    case 'ShareIcon':
      return <ShareIcon {...props} />
    case 'ShieldIcon':
      return <ShieldIcon {...props} />
    case 'ShoppingBagIcon':
      return <ShoppingBagIcon {...props} />
    case 'ShoppingCartIcon':
      return <ShoppingCartIcon {...props} />
    case 'SmileIcon':
      return <SmileIcon {...props} />
    case 'SparklesIcon':
      return <SparklesIcon {...props} />
    case 'StarIcon':
      return <StarIcon {...props} />
    case 'SunIcon':
      return <SunIcon {...props} />
    case 'TableIcon':
      return <TableIcon {...props} />
    case 'TerminalSquareIcon':
      return <TerminalSquareIcon {...props} />
    case 'Trash2Icon':
      return <Trash2Icon {...props} />
    case 'TrashIcon':
      return <TrashIcon {...props} />
    case 'TrendingUpIcon':
      return <TrendingUpIcon {...props} />
    case 'TriangleAlertIcon':
      return <TriangleAlertIcon {...props} />
    case 'UnderlineIcon':
      return <UnderlineIcon {...props} />
    case 'UserIcon':
      return <UserIcon {...props} />
    case 'UserRoundXIcon':
      return <UserRoundXIcon {...props} />
    case 'VolumeOffIcon':
      return <VolumeOffIcon {...props} />
    case 'WalletIcon':
      return <WalletIcon {...props} />
    case 'XIcon':
      return <XIcon {...props} />
    case 'ZoomInIcon':
      return <ZoomInIcon {...props} />
    case 'ZoomOutIcon':
      return <ZoomOutIcon {...props} />
    default:
      return null
  }
}
