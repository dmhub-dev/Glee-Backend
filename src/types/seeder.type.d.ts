import { CategoryDocument } from '../schemas/categories.schema';
import { VendorDocument } from '../schemas/vendor.schema';

export type SeederCategoryIdsArrayType = Pick<CategoryDocument, '_id'>[];
export type SeederVendorIdsArrayType = Pick<VendorDocument, '_id'>[];
