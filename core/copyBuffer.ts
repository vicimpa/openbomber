export const copyBuffer = (buffer: ArrayBuffer) => {
  const dataIn = new Uint8Array(buffer);
  const dataOut = new Uint8Array(buffer.byteLength);
  dataOut.set(dataIn);
  return dataOut.buffer;
};