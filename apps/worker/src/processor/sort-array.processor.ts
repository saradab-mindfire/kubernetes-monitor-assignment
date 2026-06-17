export default function sortLargeArray(size: number) {
  const arr = Array.from({ length: size }, () =>
    Math.floor(Math.random() * 100000),
  );

  arr.sort((a, b) => a - b);

  return {
    smallest: arr[0],
    largest: arr[arr.length - 1],
  };
}
