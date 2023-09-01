import { verifyApi } from "@/api";
import { calc } from "@/verify";
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

verifyApi.forward(socket, {
  verify(nums) {
    return calc(nums);
  },
  addressBlock(nums) {
    alert('На вашем адресе более ' + nums + ' подключений! Подключение невозможно!');
  }
});
