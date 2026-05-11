import BaseSocketEvent from './base.event';

export default class ConnectedSocketEvent extends BaseSocketEvent {
  static Name: string = 'CONNECTED';
  protected GetName(): string {
    return ConnectedSocketEvent.Name;
  }

  constructor(socket) {
    super(socket);
  }
}
