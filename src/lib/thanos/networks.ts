import { TZStatsNetwork } from "lib/tzstats";
import { ThanosNetwork } from "lib/thanos/types";

export const NETWORKS: ThanosNetwork[] = [
  {
    id: "mainnet",
    name: "Tezos Mainnet",
    description: "Carthage mainnet",
    type: "main",
    rpcBaseURL: "https://mainnet-tezos.giganode.io",
    tzStats: TZStatsNetwork.Mainnet,
    color: "#83b300",
    disabled: false,
  },
  {
    id: "carthagenet",
    name: "Carthage Testnet",
    description: "Carthage testnet",
    type: "test",
    rpcBaseURL: "https://testnet-tezos.giganode.io",
    tzStats: TZStatsNetwork.Carthagenet,
    color: "#0f4c81",
    disabled: false,
  },
  {
    id: "labnet",
    name: "Lab Testnet",
    description: "Labnet testnet",
    type: "test",
    rpcBaseURL: "https://labnet-tezos.giganode.io",
    tzStats: TZStatsNetwork.Labnet,
    color: "#f6c90e",
    disabled: false,
  },
  {
    id: "babylonnet",
    name: "Babylon Testnet",
    description: "Babylon testnet",
    type: "test",
    rpcBaseURL: "<no public nodes>",
    tzStats: TZStatsNetwork.Babylonnet,
    color: "#ed6663",
    disabled: true,
  },
  {
    id: "zeronet",
    name: "Zeronet",
    description: "Zeronet testnet",
    type: "test",
    rpcBaseURL: "<no public nodes>",
    tzStats: TZStatsNetwork.Zeronet,
    color: "#e9e1cc",
    disabled: true,
  },
];
