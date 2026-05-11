import {
  Prop,
  Schema,
  SchemaFactory,
  AsyncModelFactory,
} from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Model } from 'mongoose';
import { ICategorySelectableFields } from './interfaces/category';

export const adminGetRequestEventManagementCategory: ICategorySelectableFields =
  {
    name: 1,
  } as ICategorySelectableFields;

export type CategoryDocument = Category & Document;

@Schema({ timestamps: true })
export class Category extends Document {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ required: true })
  color: string;

  // @Prop({required:true})
  // icon : string
}

export const CategorySchema = SchemaFactory.createForClass(Category);
