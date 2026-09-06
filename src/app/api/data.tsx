import { title } from "process";

export const footerlabels: { label: string; herf: string }[] = [
  { label: "Terms", herf: "#" },
  { label: "Disclosures", herf: "#" },
  { label: "Latest News", herf: "#" },
  { label: "Documentation", herf: "/documentation" },
];

export const pricedeta: {
  title: string;
  short: string;
  icon: string;
  background: string;
  price: string;
  mark: string;
  width: number;
  height: number;
  padding: string;
}[] = [
  {
    title: "Bitcoin",
    short: "BTC/USD",
    icon: "/images/icons/icon-bitcoin.svg",
    background: "bg-chart-5/20",
    price: "$93,291.24",
    mark: "$94,040.99 (-0.9%)",
    width: 18,
    height: 23,
    padding: "px-4 py-3",
  },
  {
    title: "Ethereum",
    short: "ETH/USD",
    icon: "/images/icons/icon-ethereum.svg",
    background: "bg-secondary/15",
    price: "$3,128.84",
    mark: "$4,878.26 (-35.9%)",
    width: 18,
    height: 23,
    padding: "px-4 py-2",
  },
  {
    title: "Polkadot",
    short: "BTC/USD",
    icon: "/images/icons/icon-bitcoin-circle.svg",
    background: "bg-chart-5/20",
    price: "$443.27",
    mark: "$3,785.82 (-88.3%)",
    width: 46,
    height: 46,
    padding: "px-0 py-0",
  },
  {
    title: "Litecoin",
    short: "LTC/USD",
    icon: "/images/icons/icon-litecoin.svg",
    background: "bg-secondary/15",
    price: "$86.11",
    mark: "$410.26 (-79.1%)",
    width: 18,
    height: 23,
    padding: "px-4 py-3",
  },
  {
    title: "Solana",
    short: "SOL/USD",
    icon: "/images/icons/icon-solana.svg",
    background: "bg-secondary/15",
    price: "$238.70",
    mark: "$259.96 (-8.2%)",
    width: 24,
    height: 24,
    padding: "px-4 py-3",
  },
  {
    title: "Dogecoin",
    short: "DOGE/USD",
    icon: "/images/icons/icon-dogecoin.svg",
    background: "bg-secondary/15",
    price: "$0.394",
    mark: "$0.7316 (-46.2%)",
    width: 46,
    height: 46,
    padding: "px-0 py-0",
  },
];

export const portfolioData: { image: string; title: string }[] = [
  {
    image: "/images/portfolio/portfolio-icon-1.svg",
    title: "Payment management",
  },
  {
    image: "/images/portfolio/portfolio-icon-2.svg",
    title: "Virtual card control",
  },
  {
    image: "/images/portfolio/portfolio-icon-3.svg",
    title: "Mobile payments",
  },
];

export const upgradeData: { title: string }[] = [
  { title: "One balance, many cards" },
  { title: "Per-card spending limits" },
  { title: "M-Pesa and USDC top-ups" },
  { title: "Pause or close in a tap" },
  { title: "Every figure from the ledger" },
  { title: "No PAN or CVV stored" },
];

export const perksData: {
  icon: string;
  title: string;
  text: string;
  space: string;
}[] = [
  {
    icon: "/images/perks/peak-icon-1.svg",
    title: "24/7 Support",
    text: "Need help? Get your payment queries solved quickly via our support team.",
    space: "lg:mt-8",
  },
  {
    icon: "/images/perks/peak-icon-2.svg",
    title: "Community",
    text: "Join conversations on our growing Swippable community across Africa",
    space: "lg:mt-14",
  },
  {
    icon: "/images/perks/peak-icon-3.svg",
    title: "Education",
    text: "Learn about secure payments<br /> and financial inclusion.",
    space: "lg:mt-4",
  },
];

export const timelineData: {
  icon: string;
  title: string;
  text: string;
  position: string;
}[] = [
  {
    icon: "/images/solution/solution-icon-1.svg",
    title: "One shared balance",
    text: "Every card spends from the same wallet, so nothing sits stranded on a card you are not using",
    position: "md:top-0 md:left-0",
  },
  {
    icon: "/images/solution/solution-icon-2.svg",
    title: "Instant virtual cards",
    text: "Issue a card against your balance in seconds, with its own limit from the moment it exists",
    position: "md:top-0 md:right-0",
  },
  {
    icon: "/images/solution/solution-icon-3.svg",
    title: "Real-time authorisation",
    text: "Every charge is checked against the card limit and the wallet balance before it settles",
    position: "md:bottom-0 md:left-0",
  },
  {
    icon: "/images/solution/solution-icon-4.svg",
    title: "Pause and release",
    text: "Freeze a card in a tap, or release what it has not spent straight back to your wallet",
    position: "md:bottom-0 md:right-0",
  },
];

export const CryptoData: { name: string; price: number }[] = [
  { name: "Bitcoin BTC/USD", price: 67646.84 },
  { name: "Ethereum ETH/USD", price: 2515.93 },
  { name: "Bitcoin Cash BTC/USD", price: 366.96 },
  { name: "Litecoin LTC/USD", price: 61504.54 },
];
