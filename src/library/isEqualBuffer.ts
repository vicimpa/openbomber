export const isEqualBuffer = (buffer1: ArrayBuffer, buffer2: ArrayBuffer) => {
  if (buffer1 === buffer2)
    return true;

  if (buffer1.byteLength !== buffer2.byteLength)
    return false;

  const data1 = new Uint8Array(buffer1);
  const data2 = new Uint8Array(buffer2);

  for (let i = 0; i < data1.length; i++)
    if (data1[i] !== data2[i])
      return false;

  return true;
};