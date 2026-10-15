export class CreateCourseDto {
  slug: string;
  categoryName: string;
  tagBadge: string;
  typeBadge?: string;
  title: string;
  price: number;
  originalPrice: number;
  discountPercent?: number;
  image: string;
  videoDemoTitle?: string;
  videoDemoDuration?: string;
  videoDemoSubtitle?: string;
  videoUrl?: string;
  benefits?: any[];
  curriculum?: any;
  bankInfo?: any;
  resourceLink: string;
  seoTitle?: string;
  seoDescription?: string;
  ogImage?: string;
  status?: 'DRAFT' | 'PUBLISHED' | 'HIDDEN';
}
