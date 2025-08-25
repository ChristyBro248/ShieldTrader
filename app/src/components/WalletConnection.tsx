import { ConnectButton } from '@rainbow-me/rainbowkit';

const WalletConnection = () => {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <div
            {...(!ready && {
              'aria-hidden': true,
              'style': {
                opacity: 0,
                pointerEvents: 'none',
                userSelect: 'none',
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button 
                    onClick={openConnectModal} 
                    className="tech-button"
                    style={{ fontSize: '12px' }}
                  >
                    Connect Wallet
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button 
                    onClick={openChainModal} 
                    className="tech-button"
                    style={{ 
                      backgroundColor: '#ff6600', 
                      borderColor: '#ff6600',
                      fontSize: '12px'
                    }}
                  >
                    Wrong Network
                  </button>
                );
              }

              return (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button
                    onClick={openChainModal}
                    className="tech-button"
                    style={{ 
                      fontSize: '10px',
                      padding: '8px 12px'
                    }}
                  >
                    {chain.hasIcon && (
                      <div
                        style={{
                          background: chain.iconBackground,
                          width: 16,
                          height: 16,
                          borderRadius: 999,
                          overflow: 'hidden',
                          marginRight: 4,
                          display: 'inline-block'
                        }}
                      >
                        {chain.iconUrl && (
                          <img
                            alt={chain.name ?? 'Chain icon'}
                            src={chain.iconUrl}
                            style={{ width: 16, height: 16 }}
                          />
                        )}
                      </div>
                    )}
                    {chain.name}
                  </button>

                  <button 
                    onClick={openAccountModal} 
                    className="tech-button"
                    style={{ fontSize: '10px', padding: '8px 12px' }}
                  >
                    {account.displayName}
                    {account.displayBalance
                      ? ` (${account.displayBalance})`
                      : ''}
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
};

export default WalletConnection;