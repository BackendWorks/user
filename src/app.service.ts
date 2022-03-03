import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { UserRepository } from './database/repository/user.repository';
import { CreateUserDto, ForgotPasswordDto, LoginDto } from './core/dtos';
import { hashSync, compareSync } from 'bcrypt';
import { User } from './database/entities/user.entity';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { Role } from './database/entities/role.entity';
import { nanoid } from 'nanoid';
import { TokenRepository } from './database/repository/token.repository';
import { Token } from './database/entities/token.entity';
import { ConfigService } from './config/config.service';
import { Status } from './database/entities/status.entity';
import * as moment from 'moment';
import { IMailPayload } from './core/interfaces';
import { PermissionRepository } from './database/repository/permission.repository';

@Injectable()
export class AppService {
  constructor(
    @Inject('TOKEN_SERVICE') private readonly tokenClient: ClientProxy,
    @Inject('MAIL_SERVICE') private readonly mailClient: ClientProxy,
    private userRepository: UserRepository,
    private tokenRepository: TokenRepository,
    private configService: ConfigService,
    private permissionRepository: PermissionRepository,
  ) {
    this.tokenClient.connect();
    this.mailClient.connect();
    // uncomment below function to seed permissions table
    // this.seedPermissions();
  }

  /**
   * Seeds permission data into the table
   */
  seedPermissions = async () => {
    await this.permissionRepository.insertPermissions();
    console.log('Permissions seeded!!!');
  };

  public getUserById(userId: number) {
    return this.userRepository.findOne(userId);
  }

  public createHash(password: string): string {
    return hashSync(password, 10);
  }

  public compare(password: string, hash: string): boolean {
    return compareSync(hash, password);
  }

  public async getDeviceById(userId: number): Promise<string> {
    const user = await this.userRepository.findOne(userId);
    return user.deviceToken;
  }

  public async getForgotPasswordToken(authUserId: number): Promise<Token> {
    try {
      const user = await this.userRepository.findOne({ id: authUserId });
      if (!user) {
        throw new HttpException('USER_NOT_FOUND', HttpStatus.NOT_FOUND);
      }
      const token = nanoid(10);
      const newToken = new Token();
      newToken.forgotToken = token;
      newToken.status = Status.Active;
      newToken.user = user;
      const gen_token = await this.tokenRepository.save(newToken);
      delete gen_token.user.password;
      return gen_token;
    } catch (e) {
      throw new InternalServerErrorException(e);
    }
  }

  public async changePassword(
    data: ForgotPasswordDto,
    authUserId: number,
  ): Promise<void> {
    try {
      const { newPassword, token } = data;
      const user = await this.userRepository.findOne({ id: authUserId });
      if (!user) {
        throw new HttpException('USER_NOT_FOUND', HttpStatus.NOT_FOUND);
      }
      const getActiveToken = await this.tokenRepository.findOne({
        user: { id: authUserId },
        status: Status.Active,
        forgotToken: token,
      });
      if (!getActiveToken) {
        throw new HttpException(
          'ACTIVE_TOKEN_NOT_FOUND',
          HttpStatus.BAD_REQUEST,
        );
      }
      const addExp = moment().add(
        Number(this.configService.get('tokenExp')),
        'second',
      );
      if (moment(getActiveToken.createdAt).isAfter(addExp)) {
        throw new HttpException(
          'FORGOT_TOKEN_EXPIRED',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      const hashPassword = this.createHash(newPassword);
      await this.userRepository.update(
        { id: authUserId },
        { password: hashPassword },
      );
      const payload: IMailPayload = {
        template: 'FORGOT_PASSWORD',
        payload: {
          emails: [user.email],
          data: {
            firstName: user.firstName,
            lastName: user.lastName,
          },
          subject: 'Forgot Password',
        },
      };
      this.mailClient.emit('send_email', payload);
    } catch (e) {
      throw new InternalServerErrorException(e);
    }
  }

  public async login(data: LoginDto) {
    try {
      const { email, password } = data;
      const checkUser = await this.userRepository.findUserAccountByEmail(email);
      if (!checkUser) {
        throw new HttpException(
          'USER_NOT_FOUND',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      if (this.compare(password, checkUser.password)) {
        throw new HttpException('INVALID_PASSWORD', HttpStatus.CONFLICT);
      }
      const createTokenResponse = await firstValueFrom(
        this.tokenClient.send(
          'token_create',
          JSON.stringify({
            id: checkUser.id,
            role: checkUser.role,
          }),
        ),
      );
      delete checkUser.password;
      return {
        ...createTokenResponse,
        user: checkUser,
      };
    } catch (e) {
      throw new InternalServerErrorException(e);
    }
  }

  public async signup(data: CreateUserDto) {
    try {
      const { email, password, firstname, lastname } = data;
      const checkUser = await this.userRepository.findUserAccountByEmail(email);
      if (checkUser) {
        throw new HttpException('USER_EXISTS', HttpStatus.CONFLICT);
      }
      const hashPassword = this.createHash(password);
      const newUser = new User();
      newUser.email = data.email;
      newUser.password = hashPassword;
      newUser.firstName = firstname.trim();
      newUser.lastName = lastname.trim();
      newUser.role = Role.USER;
      const user = await this.userRepository.save(newUser);
      const createTokenResponse = await firstValueFrom(
        this.tokenClient.send(
          'token_create',
          JSON.stringify({ id: user.id, role: user.role }),
        ),
      );
      delete user.password;
      return {
        ...createTokenResponse,
        user,
      };
    } catch (e) {
      throw new InternalServerErrorException(e);
    }
  }
}
