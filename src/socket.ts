import { connect } from "socket.io-client";

import { calc } from "@core/verify";
import { verifyApi } from "@shared/api";

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

verifyApi.forward(socket, {
  verify(nums) {
    return calc(nums);
  },
  addressBlock(nums) {
    alert('На вашем адресе более ' + nums + ' подключений! Подключение невозможно!');
  }
});
