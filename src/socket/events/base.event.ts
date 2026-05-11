export default abstract class BaseSocketEvent {
  private _socket;

  constructor(socket) {
    this._socket = socket;
  }

  protected abstract GetName(): string;

  protected GetData(): Object {
    return {};
  }

  public GetSocket() {
    return this._socket;
  }
  public EmitToIndividualSocket(socketId: string) {
    this._socket.to(socketId).emit(this.GetName(), this.GetData());
  }

  public IOEmitToIndividualSocket(io, socketId: string) {
    io.to(socketId).emit(this.GetName(), this.GetData());
  }

  public Emit() {
    this._socket.emit(this.GetName(), this.GetData());
  }

  public EmitError(statusCode: number, messageData?: any) {
    const error: any = new Error();
    error.Status = statusCode;
    this._socket.error(error);
  }
}
