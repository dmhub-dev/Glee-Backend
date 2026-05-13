import { Injectable } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { OnesignalService } from 'src/onesignal/onesignal.service';

interface DecodedUser {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}
@Injectable()
export class SocketEventHandler {
  constructor(
    private _userService: UsersService,
    private jwtService: JwtService,
    private oneSignalService: OnesignalService,
  ) {}

  sendNotif(server, userId, eventType) {
    server.to(userId).emit(eventType, '');
  }

  async onDisconnect(client: Socket) {
    const auth = await this.socketAuth(client);
    if (auth == false) {
      return client.disconnect();
    }

    client.leave(auth.id);
    client.disconnect();
  }

  private async socketAuth(socket: any) {
    const token = socket.handshake.auth.token;
    let user: DecodedUser | null;
    try {
      user = (await this.jwtService.verifyAsync(token)) as DecodedUser;
    } catch (err) {
      return false;
    }

    if (user == null) {
      return false;
    }

    const userDoc = await this._userService.findOne({
      id: user.userId,
      email: user.email,
    });

    if (userDoc == null) {
      return false;
    }
    return userDoc;
  }

  async onConnect(socket: Socket) {
    const auth = await this.socketAuth(socket);
    if (auth == false) {
      socket.emit('auth failed', { message: 'Invalid token' });
      return socket.disconnect();
    }
    socket.join(auth.id.toString());
  }
}
