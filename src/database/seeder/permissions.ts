import { Role } from '../entities/role.entity';

export default [
  { permission: 'post-create', role: Role.ADMIN },
  { permission: 'post-get', role: Role.ADMIN },
  { permission: 'post-update', role: Role.ADMIN },
  { permission: 'post-get', role: Role.USER },
];
