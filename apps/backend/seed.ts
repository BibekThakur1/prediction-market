import { prisma } from "db";

const markets = [
  { id: "6bfa94f7-8ba2-4ab5-bf09-498874a4f001", title: "Will Bitcoin trade above $150,000 before 2027?", category: "Crypto", description: "Resolves YES if BTC/USD trades at or above $150,000 on Coinbase before January 1, 2027.", resolutionDescription: "Coinbase BTC-USD daily high is the primary resolution source." },
  { id: "6bfa94f7-8ba2-4ab5-bf09-498874a4f002", title: "Will a crewed mission land on Mars before 2031?", category: "Science", description: "Resolves YES if humans land on the surface of Mars before January 1, 2031.", resolutionDescription: "Official mission telemetry and independent reporting must confirm the landing." },
  { id: "6bfa94f7-8ba2-4ab5-bf09-498874a4f003", title: "Will an AI system win a major mathematics olympiad by 2028?", category: "AI", description: "Resolves YES if an AI wins an officially recognized international-level mathematics olympiad before 2028.", resolutionDescription: "The organizing body must publish the final result." },
  { id: "6bfa94f7-8ba2-4ab5-bf09-498874a4f004", title: "Will global average temperature exceed 1.6°C in 2027?", category: "Climate", description: "Resolves YES if the published annual global temperature anomaly for 2027 exceeds 1.6°C above the pre-industrial baseline.", resolutionDescription: "Uses the finalized Copernicus annual global climate report." },
];

async function seed() {
  for (const market of markets) {
    await prisma.market.upsert({ where: { id: market.id }, create: market, update: market });
  }
  console.log(`Seeded ${markets.length} markets`);
}

seed().finally(() => prisma.$disconnect());
