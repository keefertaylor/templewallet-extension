import * as React from "react";
import constate from "constate";
import {
  WalletProvider,
  createOriginationOperation,
  createSetDelegateOperation,
  createTransferOperation,
  WalletDelegateParams,
  WalletOriginateParams,
  WalletTransferParams,
} from "@taquito/taquito";
import { buf2hex } from "@taquito/utils";
import { nanoid } from "nanoid";
import { useRetryableSWR } from "lib/swr";
import toBuffer from "typedarray-to-buffer";
import { IntercomClient } from "lib/intercom";
import { useStorage } from "lib/temple/front";
import {
  TempleConfirmationPayload,
  TempleMessageType,
  TempleStatus,
  TempleRequest,
  TempleResponse,
  TempleNotification,
  TempleSettings,
} from "lib/temple/types";

type Confirmation = {
  id: string;
  payload: TempleConfirmationPayload;
};

const intercom = new IntercomClient();

export const [TempleClientProvider, useTempleClient] = constate(() => {
  /**
   * State
   */

  const fetchState = React.useCallback(async () => {
    const res = await request({ type: TempleMessageType.GetStateRequest });
    assertResponse(res.type === TempleMessageType.GetStateResponse);
    return res.state;
  }, []);

  const { data, revalidate } = useRetryableSWR("state", fetchState, {
    suspense: true,
    shouldRetryOnError: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });
  const state = data!;

  const [confirmation, setConfirmation] = React.useState<Confirmation | null>(
    null
  );
  const confirmationIdRef = React.useRef<string | null>(null);
  const resetConfirmation = React.useCallback(() => {
    confirmationIdRef.current = null;
    setConfirmation(null);
  }, [setConfirmation]);

  React.useEffect(() => {
    return intercom.subscribe((msg: TempleNotification) => {
      switch (msg?.type) {
        case TempleMessageType.StateUpdated:
          revalidate();
          break;

        case TempleMessageType.ConfirmationRequested:
          if (msg.id === confirmationIdRef.current) {
            setConfirmation({ id: msg.id, payload: msg.payload });
          }
          break;

        case TempleMessageType.ConfirmationExpired:
          if (msg.id === confirmationIdRef.current) {
            resetConfirmation();
          }
          break;
      }
    });
  }, [revalidate, setConfirmation, resetConfirmation]);

  /**
   * Aliases
   */

  const { status, networks: defaultNetworks, accounts, settings } = state;
  const idle = status === TempleStatus.Idle;
  const locked = status === TempleStatus.Locked;
  const ready = status === TempleStatus.Ready;

  const customNetworks = React.useMemo(() => {
    const customNetworksWithoutLambdaContracts = settings?.customNetworks ?? [];
    return customNetworksWithoutLambdaContracts.map((network) => {
      return {
        ...network,
        lambdaContract: settings?.lambdaContracts?.[network.id],
      };
    });
  }, [settings]);
  const defaultNetworksWithLambdaContracts = React.useMemo(() => {
    return defaultNetworks.map((network) => ({
      ...network,
      lambdaContract:
        network.lambdaContract || settings?.lambdaContracts?.[network.id],
    }));
  }, [settings, defaultNetworks]);
  const networks = React.useMemo(
    () => [...defaultNetworksWithLambdaContracts, ...customNetworks],
    [defaultNetworksWithLambdaContracts, customNetworks]
  );

  /**
   * Backup seed phrase flag
   */
  const [seedRevealed, setSeedRevealed] = useStorage("seed_revealed", true);

  /**
   * Actions
   */

  const registerWallet = React.useCallback(
    async (password: string, mnemonic?: string) => {
      const res = await request({
        type: TempleMessageType.NewWalletRequest,
        password,
        mnemonic,
      });
      assertResponse(res.type === TempleMessageType.NewWalletResponse);
    },
    []
  );

  const unlock = React.useCallback(async (password: string) => {
    const res = await request({
      type: TempleMessageType.UnlockRequest,
      password,
    });
    assertResponse(res.type === TempleMessageType.UnlockResponse);
  }, []);

  const lock = React.useCallback(async () => {
    const res = await request({
      type: TempleMessageType.LockRequest,
    });
    assertResponse(res.type === TempleMessageType.LockResponse);
  }, []);

  const createAccount = React.useCallback(async (name?: string) => {
    const res = await request({
      type: TempleMessageType.CreateAccountRequest,
      name,
    });
    assertResponse(res.type === TempleMessageType.CreateAccountResponse);
  }, []);

  const revealPrivateKey = React.useCallback(
    async (accountPublicKeyHash: string, password: string) => {
      const res = await request({
        type: TempleMessageType.RevealPrivateKeyRequest,
        accountPublicKeyHash,
        password,
      });
      assertResponse(res.type === TempleMessageType.RevealPrivateKeyResponse);
      return res.privateKey;
    },
    []
  );

  const revealMnemonic = React.useCallback(async (password: string) => {
    const res = await request({
      type: TempleMessageType.RevealMnemonicRequest,
      password,
    });
    assertResponse(res.type === TempleMessageType.RevealMnemonicResponse);
    return res.mnemonic;
  }, []);

  const removeAccount = React.useCallback(
    async (accountPublicKeyHash: string, password: string) => {
      const res = await request({
        type: TempleMessageType.RemoveAccountRequest,
        accountPublicKeyHash,
        password,
      });
      assertResponse(res.type === TempleMessageType.RemoveAccountResponse);
    },
    []
  );

  const editAccountName = React.useCallback(
    async (accountPublicKeyHash: string, name: string) => {
      const res = await request({
        type: TempleMessageType.EditAccountRequest,
        accountPublicKeyHash,
        name,
      });
      assertResponse(res.type === TempleMessageType.EditAccountResponse);
    },
    []
  );

  const importAccount = React.useCallback(
    async (privateKey: string, encPassword?: string) => {
      const res = await request({
        type: TempleMessageType.ImportAccountRequest,
        privateKey,
        encPassword,
      });
      assertResponse(res.type === TempleMessageType.ImportAccountResponse);
    },
    []
  );

  const importMnemonicAccount = React.useCallback(
    async (mnemonic: string, password?: string, derivationPath?: string) => {
      const res = await request({
        type: TempleMessageType.ImportMnemonicAccountRequest,
        mnemonic,
        password,
        derivationPath,
      });
      assertResponse(
        res.type === TempleMessageType.ImportMnemonicAccountResponse
      );
    },
    []
  );

  const importFundraiserAccount = React.useCallback(
    async (email: string, password: string, mnemonic: string) => {
      const res = await request({
        type: TempleMessageType.ImportFundraiserAccountRequest,
        email,
        password,
        mnemonic,
      });
      assertResponse(
        res.type === TempleMessageType.ImportFundraiserAccountResponse
      );
    },
    []
  );

  const importKTManagedAccount = React.useCallback(
    async (address: string, chainId: string, owner: string) => {
      const res = await request({
        type: TempleMessageType.ImportManagedKTAccountRequest,
        address,
        chainId,
        owner,
      });
      assertResponse(
        res.type === TempleMessageType.ImportManagedKTAccountResponse
      );
    },
    []
  );

  const importWatchOnlyAccount = React.useCallback(
    async (address: string, chainId?: string) => {
      const res = await request({
        type: TempleMessageType.ImportWatchOnlyAccountRequest,
        address,
        chainId,
      });
      assertResponse(
        res.type === TempleMessageType.ImportWatchOnlyAccountResponse
      );
    },
    []
  );

  const createLedgerAccount = React.useCallback(
    async (name: string, derivationPath?: string) => {
      const res = await request({
        type: TempleMessageType.CreateLedgerAccountRequest,
        name,
        derivationPath,
      });
      assertResponse(
        res.type === TempleMessageType.CreateLedgerAccountResponse
      );
    },
    []
  );

  const updateSettings = React.useCallback(
    async (settings: Partial<TempleSettings>) => {
      const res = await request({
        type: TempleMessageType.UpdateSettingsRequest,
        settings,
      });
      assertResponse(res.type === TempleMessageType.UpdateSettingsResponse);
    },
    []
  );

  const getAllPndOps = React.useCallback(
    async (accountPublicKeyHash: string, netId: string) => {
      const res = await request({
        type: TempleMessageType.GetAllPndOpsRequest,
        accountPublicKeyHash,
        netId,
      });
      assertResponse(res.type === TempleMessageType.GetAllPndOpsResponse);
      return res.operations;
    },
    []
  );

  const removePndOps = React.useCallback(
    async (accountPublicKeyHash: string, netId: string, opHashes: string[]) => {
      const res = await request({
        type: TempleMessageType.RemovePndOpsRequest,
        accountPublicKeyHash,
        netId,
        opHashes,
      });
      assertResponse(res.type === TempleMessageType.RemovePndOpsResponse);
    },
    []
  );

  const confirmInternal = React.useCallback(
    async (id: string, confirmed: boolean) => {
      const res = await request({
        type: TempleMessageType.ConfirmationRequest,
        id,
        confirmed,
      });
      assertResponse(res.type === TempleMessageType.ConfirmationResponse);
    },
    []
  );

  const getDAppPayload = React.useCallback(async (id: string) => {
    const res = await request({
      type: TempleMessageType.DAppGetPayloadRequest,
      id,
    });
    assertResponse(res.type === TempleMessageType.DAppGetPayloadResponse);
    return res.payload;
  }, []);

  const confirmDAppPermission = React.useCallback(
    async (id: string, confirmed: boolean, pkh: string) => {
      const res = await request({
        type: TempleMessageType.DAppPermConfirmationRequest,
        id,
        confirmed,
        accountPublicKeyHash: pkh,
        accountPublicKey: await getPublicKey(pkh),
      });
      assertResponse(
        res.type === TempleMessageType.DAppPermConfirmationResponse
      );
    },
    []
  );

  const confirmDAppOperation = React.useCallback(
    async (id: string, confirmed: boolean) => {
      const res = await request({
        type: TempleMessageType.DAppOpsConfirmationRequest,
        id,
        confirmed,
      });
      assertResponse(
        res.type === TempleMessageType.DAppOpsConfirmationResponse
      );
    },
    []
  );

  const confirmDAppSign = React.useCallback(
    async (id: string, confirmed: boolean) => {
      const res = await request({
        type: TempleMessageType.DAppSignConfirmationRequest,
        id,
        confirmed,
      });
      assertResponse(
        res.type === TempleMessageType.DAppSignConfirmationResponse
      );
    },
    []
  );

  const createTaquitoWallet = React.useCallback(
    (sourcePkh: string, networkRpc: string) =>
      new TaquitoWallet(sourcePkh, networkRpc, {
        onBeforeSend: (id) => {
          confirmationIdRef.current = id;
        },
      }),
    []
  );

  const createTaquitoSigner = React.useCallback(
    (sourcePkh: string) =>
      new TempleSigner(sourcePkh, (id) => {
        confirmationIdRef.current = id;
      }),
    []
  );

  const getAllDAppSessions = React.useCallback(async () => {
    const res = await request({
      type: TempleMessageType.DAppGetAllSessionsRequest,
    });
    assertResponse(res.type === TempleMessageType.DAppGetAllSessionsResponse);
    return res.sessions;
  }, []);

  const removeDAppSession = React.useCallback(async (origin: string) => {
    const res = await request({
      type: TempleMessageType.DAppRemoveSessionRequest,
      origin,
    });
    assertResponse(res.type === TempleMessageType.DAppRemoveSessionResponse);
    return res.sessions;
  }, []);

  return {
    state,

    // Aliases
    status,
    defaultNetworks,
    customNetworks: defaultNetworksWithLambdaContracts,
    networks,
    accounts,
    settings,
    idle,
    locked,
    ready,

    // Misc
    confirmation,
    resetConfirmation,
    seedRevealed,
    setSeedRevealed,

    // Actions
    registerWallet,
    unlock,
    lock,
    createAccount,
    revealPrivateKey,
    revealMnemonic,
    removeAccount,
    editAccountName,
    importAccount,
    importMnemonicAccount,
    importFundraiserAccount,
    importKTManagedAccount,
    importWatchOnlyAccount,
    createLedgerAccount,
    updateSettings,
    getAllPndOps,
    removePndOps,
    confirmInternal,
    getDAppPayload,
    confirmDAppPermission,
    confirmDAppOperation,
    confirmDAppSign,
    createTaquitoWallet,
    createTaquitoSigner,
    getAllDAppSessions,
    removeDAppSession,
  };
});

type TaquitoWalletOps = {
  onBeforeSend?: (id: string) => void;
};

class TaquitoWallet implements WalletProvider {
  constructor(
    private pkh: string,
    private rpc: string,
    private opts: TaquitoWalletOps = {}
  ) {}

  async getPKH() {
    return this.pkh;
  }

  async mapTransferParamsToWalletParams(params: WalletTransferParams) {
    return createTransferOperation(params);
  }

  async mapOriginateParamsToWalletParams(params: WalletOriginateParams) {
    return createOriginationOperation(params as any);
  }

  async mapDelegateParamsToWalletParams(params: WalletDelegateParams) {
    return createSetDelegateOperation(params as any);
  }

  async sendOperations(opParams: any[]) {
    const id = nanoid();
    if (this.opts.onBeforeSend) {
      this.opts.onBeforeSend(id);
    }
    const res = await request({
      type: TempleMessageType.OperationsRequest,
      id,
      sourcePkh: this.pkh,
      networkRpc: this.rpc,
      opParams: opParams.map(formatOpParams),
    });
    assertResponse(res.type === TempleMessageType.OperationsResponse);
    return res.opHash;
  }
}

class TempleSigner {
  constructor(
    private pkh: string,
    private onBeforeSign?: (id: string) => void
  ) {}

  async publicKeyHash() {
    return this.pkh;
  }

  async publicKey(): Promise<string> {
    return getPublicKey(this.pkh);
  }

  async secretKey(): Promise<string> {
    throw new Error("Secret key cannot be exposed");
  }

  async sign(bytes: string, watermark?: Uint8Array) {
    const id = nanoid();
    if (this.onBeforeSign) {
      this.onBeforeSign(id);
    }
    const res = await request({
      type: TempleMessageType.SignRequest,
      sourcePkh: this.pkh,
      id,
      bytes,
      watermark: watermark ? buf2hex(toBuffer(watermark)) : undefined,
    });
    assertResponse(res.type === TempleMessageType.SignResponse);
    return res.result;
  }
}

function formatOpParams(op: any) {
  switch (op.kind) {
    case "origination":
      return {
        ...op,
        mutez: true, // The balance was already converted from Tez (ꜩ) to Mutez (uꜩ)
      };
    case "transaction":
      const { destination, amount, parameters, ...txRest } = op;
      return {
        ...txRest,
        to: destination,
        amount: +amount,
        mutez: true,
        parameter: parameters,
      };
    default:
      return op;
  }
}

async function getPublicKey(accountPublicKeyHash: string) {
  const res = await request({
    type: TempleMessageType.RevealPublicKeyRequest,
    accountPublicKeyHash,
  });
  assertResponse(res.type === TempleMessageType.RevealPublicKeyResponse);
  return res.publicKey;
}

async function request<T extends TempleRequest>(req: T) {
  const res = await intercom.request(req);
  assertResponse("type" in res);
  return res as TempleResponse;
}

function assertResponse(condition: any): asserts condition {
  if (!condition) {
    throw new Error("Invalid response recieved");
  }
}
