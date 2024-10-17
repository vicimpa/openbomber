import { IS_DEV } from "./env";
import { calc } from "@ob/core/verify";
import { connect } from "socket.io-client";
import { verifyApi } from "@ob/shared/api";

export const socket = connect(IS_DEV ? 'localhost:3001' : location.origin, {
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
  },
});
