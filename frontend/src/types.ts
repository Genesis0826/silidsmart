export type UserRole = 'renter' | 'owner' | 'admin';

export type PropertyType = 'Boarding house' | 'Apartment' | 'Dorm' | 'Condo';

export type OccupancyStatus = 'Vacant' | 'Occupied';

export type RentPaymentStatus = 'Paid' | 'Due' | 'Overdue';

export type IDReviewStatus = 'Pending review' | 'ID reviewed' | 'Needs correction';

export type InquiryStatus = 'Pending' | 'Approved' | 'Declined';

export type ReportStatus = 'Pending' | 'Resolved';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarInitials: string;
  phone?: string;
  ownerId?: string;
  managedUnitsCount?: number;
}

export interface Owner {
  id: string;
  displayName: string;
  contactMethod?: string;
  idReviewStatus: IDReviewStatus;
  idSubmissionDate: string;
  idDocumentName?: string;
}

export interface Property {
  id: string;
  ownerId: string;
  name: string;
  type: PropertyType;
  area: string;
  address: string;
  rules: string[];
  amenities: string[];
  contactMethod: string;
  imageUrl?: string;
  latitude?: number | null;
  longitude?: number | null;
  mapScope?: 'ust' | 'qc' | null;
}

export interface Unit {
  id: string;
  propertyId: string;
  unitLabel: string;
  monthlyRent: number;
  deposit: number;
  status: OccupancyStatus;
  published: boolean;
  lastUpdated: string;
  description: string;
  expectedAvailableFrom?: string | null;
}

export interface UtilityRecord {
  id: string;
  unitId: string;
  utilityType: 'Electricity' | 'Water';
  billingMonth: string;
  amountPhp: number;
  dueDate: string;
  paymentStatus: RentPaymentStatus;
  paymentDate: string | null;
  reference: string;
  recordedAt: string;
}

export type UtilityInput = Omit<UtilityRecord, 'id' | 'recordedAt'>;
export type DirectorySettings = { published: boolean; expectedAvailableFrom: string | null };

export interface Tenant {
  id: string;
  unitId: string;
  name: string;
  contact: string;
  moveInDate: string;
  notes?: string;
}

export interface RentRecord {
  id: string;
  unitId: string;
  tenantName: string;
  month: string;
  amountDue: number;
  paymentStatus: RentPaymentStatus;
  recordedDate: string;
}

export interface Inquiry {
  id: string;
  unitId: string;
  propertyId: string;
  propertyName: string;
  unitLabel: string;
  renterName: string;
  renterContact: string;
  moveInDate: string;
  message: string;
  status: InquiryStatus;
  submittedAt: string;
}

export interface ShortStay {
  id: string;
  unitId: string;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  rentTotalPhp: number;
  source: 'SilidSmart' | 'Other';
  status: 'Completed' | 'Cancelled';
  commissionPercent: number;
  commissionPhp: number;
  recordedAt: string;
}

export type ShortStayInput = Pick<ShortStay,
  'unitId' | 'guestName' | 'checkInDate' | 'checkOutDate' | 'rentTotalPhp' | 'source'>;

export interface ListingReport {
  id: string;
  unitId: string;
  propertyName: string;
  unitLabel: string;
  reason: string;
  details: string;
  submittedDate: string;
  status: ReportStatus;
}

export interface SystemEvent {
  id: string;
  timestamp: string;
  category: 'SYNC' | 'INQUIRY' | 'MODERATION' | 'BILLING';
  message: string;
}
