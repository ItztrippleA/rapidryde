export type Role = 'customer' | 'driver' | 'admin';

export type JwtPayload = {
  sub: string;
  role: Role;
  phone: string;
};
