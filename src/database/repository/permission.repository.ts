import { EntityRepository, Repository } from 'typeorm';
import { Permissions } from '../entities/permission.entity';
import permissions from '../seeder/permissions';

@EntityRepository(Permissions)
export class PermissionRepository extends Repository<Permissions> {
  /**
   * It seeds permissions associated with roles in database
   * @param payload
   * @returns
   */
  public insertPermissions = async () => {
    const response = await this.insert(permissions);
    return response;
  };
}
