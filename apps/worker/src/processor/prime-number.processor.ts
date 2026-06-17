export default function calculatePrimes(limit: number) {
  const primes: number[] = [];

  for (let i = 2; i <= limit; i++) {
    let prime = true;
    for (let j = 2; j * j <= i; j++) {
      if (i % j === 0) {
        prime = false;
        break;
      }
    }

    if (prime) primes.push(i);
  }

  console.log(`Calculated ${primes.length} prime numbers up to ${limit}.`);

  return primes.length;
}
