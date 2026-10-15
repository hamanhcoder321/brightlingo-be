export class CreateOrderDto {
  courseId: string;
  courseSlug: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  couponCode?: string;
  ref?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  landingUrl?: string;
  referrerUrl?: string;
}
