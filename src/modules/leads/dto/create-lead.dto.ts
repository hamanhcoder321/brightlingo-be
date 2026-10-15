export class CreateLeadDto {
  fullName: string;
  phone: string;
  email?: string;
  courseSlug?: string;
  courseName?: string;
  message?: string;
  ref?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}
