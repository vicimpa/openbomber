import { connect } from "socket.io-client";

export const socket = connect({
  reconnectionDelay: 500,
  reconnectionDelayMax: 500,
  autoConnect: false,
});

socket.once('disconnect', () => {
  socket.once('connect', () => {
    location.reload();
  });
});