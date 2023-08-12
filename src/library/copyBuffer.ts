export const copyBuffer = (buffer: ArrayBuffer) => {
  const output = new ArrayBuffer(buffer.byteLength);
  const dataIn = new Uint8Array(buffer);
  const dataOut = new Uint8Array(output);
  dataOut.set(dataIn);
  return output;
};