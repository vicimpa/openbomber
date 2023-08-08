import { connect } from "socket.io-client";

export const socket = connect(`ws://${location.hostname}:3001`, {
  reconnectionDelay: 500,
  reconnectionDelayMax: 500,
  autoConnect: false,
});