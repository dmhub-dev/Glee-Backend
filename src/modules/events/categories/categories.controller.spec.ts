import 'reflect-metadata';
import { PERMISSIONS_KEY } from '@src/auth/rbac/permissions.decorator';
import { CategoriesController } from './categories.controller';

describe('CategoriesController public routes', () => {
  it('does not require RBAC permissions for the public category list', () => {
    const permissions = Reflect.getMetadata(
      PERMISSIONS_KEY,
      CategoriesController.prototype.findAll,
    );

    expect(permissions).toBeUndefined();
  });

  it('does not require RBAC permissions for the public category detail', () => {
    const permissions = Reflect.getMetadata(
      PERMISSIONS_KEY,
      CategoriesController.prototype.findOne,
    );

    expect(permissions).toBeUndefined();
  });
});
