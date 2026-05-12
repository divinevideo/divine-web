import { useState, forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Wallet, Plus, Trash as Trash2, Lightning as Zap, Globe, Wallet as WalletMinimal, CheckCircle, X } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerClose,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useNWC } from '@/hooks/useNWCContext';
import { useWallet } from '@/hooks/useWallet';
import { useToast } from '@/hooks/useToast';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { NWCConnection, NWCInfo } from '@/hooks/useNWC';

interface WalletModalProps {
  children?: React.ReactNode;
  className?: string;
}

// Extracted AddWalletContent to prevent re-renders
const AddWalletContent = forwardRef<HTMLDivElement, {
  alias: string;
  setAlias: (value: string) => void;
  connectionUri: string;
  setConnectionUri: (value: string) => void;
}>(({ alias, setAlias, connectionUri, setConnectionUri }, ref) => {
  const { t } = useTranslation();
  return (
  <div className="space-y-4 px-4" ref={ref}>
    <div>
      <Label htmlFor="alias">{t('walletModal.walletNameLabel')}</Label>
      <Input
        id="alias"
        placeholder={t('walletModal.walletNamePlaceholder')}
        value={alias}
        onChange={(e) => setAlias(e.target.value)}
      />
    </div>
    <div>
      <Label htmlFor="connection-uri">{t('walletModal.connectionUriLabel')}</Label>
      <Textarea
        id="connection-uri"
        placeholder="nostr+walletconnect://..."
        value={connectionUri}
        onChange={(e) => setConnectionUri(e.target.value)}
        rows={3}
      />
    </div>
  </div>
  );
});
AddWalletContent.displayName = 'AddWalletContent';

// Extracted WalletContent to prevent re-renders
const WalletContent = forwardRef<HTMLDivElement, {
  hasWebLN: boolean;
  isDetecting: boolean;
  hasNWC: boolean;
  connections: NWCConnection[];
  connectionInfo: Record<string, NWCInfo>;
  activeConnection: string | null;
  handleSetActive: (cs: string) => void;
  handleRemoveConnection: (cs: string) => void;
  setAddDialogOpen: (open: boolean) => void;
}>(({
  hasWebLN,
  isDetecting,
  hasNWC,
  connections,
  connectionInfo,
  activeConnection,
  handleSetActive,
  handleRemoveConnection,
  setAddDialogOpen
}, ref) => {
  const { t } = useTranslation();
  return (
  <div className="space-y-6 px-4 pb-4" ref={ref}>
    {/* Current Status */}
    <div className="space-y-3">
      <h3 className="font-medium">{t('walletModal.currentStatus')}</h3>
      <div className="grid gap-3">
        {/* WebLN */}
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-3">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{t('walletModal.webln')}</p>
              <p className="text-xs text-muted-foreground">{t('walletModal.browserExtension')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasWebLN && <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />}
            <Badge variant={hasWebLN ? "default" : "secondary"} className="text-xs">
              {isDetecting ? t('walletModal.detecting') : hasWebLN ? t('walletModal.ready') : t('walletModal.notFound')}
            </Badge>
          </div>
        </div>
        {/* NWC */}
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-3">
            <WalletMinimal className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{t('walletModal.nostrWalletConnect')}</p>
              <p className="text-xs text-muted-foreground">
                {connections.length > 0
                  ? t('walletModal.walletsConnected', { count: connections.length })
                  : t('walletModal.remoteWalletConnection')
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasNWC && <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />}
            <Badge variant={hasNWC ? "default" : "secondary"} className="text-xs">
              {hasNWC ? t('walletModal.ready') : t('walletModal.none')}
            </Badge>
          </div>
        </div>
      </div>
    </div>
    <Separator />
    {/* NWC Management */}
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{t('walletModal.nostrWalletConnect')}</h3>
        <Button size="sm" variant="outline" onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          {t('walletModal.add')}
        </Button>
      </div>
      {/* Connected Wallets List */}
      {connections.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <p className="text-sm">{t('walletModal.noWalletsYet')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {connections.map((connection) => {
            const info = connectionInfo[connection.connectionString];
            const isActive = activeConnection === connection.connectionString;
            return (
              <div key={connection.connectionString} className={`flex items-center justify-between p-3 border rounded-lg ${isActive ? 'ring-2 ring-primary' : ''}`}>
                <div className="flex items-center gap-3">
                  <WalletMinimal className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      {connection.alias || info?.alias || t('walletModal.lightningWallet')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('walletModal.nwcConnection')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isActive && <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />}
                  {!isActive && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSetActive(connection.connectionString)}
                    >
                      <Zap className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveConnection(connection.connectionString)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    {/* Help */}
    {!hasWebLN && connections.length === 0 && (
      <>
        <Separator />
        <div className="text-center py-4 space-y-2">
          <p className="text-sm text-muted-foreground">
            {t('walletModal.installHelp')}
          </p>
        </div>
      </>
    )}
  </div>
  );
});
WalletContent.displayName = 'WalletContent';

export function WalletModal({ children, className }: WalletModalProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [connectionUri, setConnectionUri] = useState('');
  const [alias, setAlias] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const isMobile = useIsMobile();

  const {
    connections,
    activeConnection,
    connectionInfo,
    addConnection,
    removeConnection,
    setActiveConnection
  } = useNWC();

  const { hasWebLN, isDetecting } = useWallet();

  const hasNWC = connections.length > 0 && connections.some(c => c.isConnected);
  const { toast } = useToast();

  const handleAddConnection = async () => {
    if (!connectionUri.trim()) {
      toast({
        title: t('walletModal.connectionUriRequiredTitle'),
        description: t('walletModal.connectionUriRequiredDescription'),
        variant: 'destructive',
      });
      return;
    }

    setIsConnecting(true);
    try {
      const success = await addConnection(connectionUri.trim(), alias.trim() || undefined);
      if (success) {
        setConnectionUri('');
        setAlias('');
        setAddDialogOpen(false);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleRemoveConnection = (connectionString: string) => {
    removeConnection(connectionString);
  };

  const handleSetActive = (connectionString: string) => {
    setActiveConnection(connectionString);
    toast({
      title: t('walletModal.activeWalletChangedTitle'),
      description: t('walletModal.activeWalletChangedDescription'),
    });
  };

  const walletContentProps = {
    hasWebLN,
    isDetecting,
    hasNWC,
    connections,
    connectionInfo,
    activeConnection,
    handleSetActive,
    handleRemoveConnection,
    setAddDialogOpen,
  };

  const addWalletDialog = (
    <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('walletModal.connectNwcWalletTitle')}</DialogTitle>
          <DialogDescription>
            {t('walletModal.connectNwcWalletDescription')}
          </DialogDescription>
        </DialogHeader>
        <AddWalletContent
          alias={alias}
          setAlias={setAlias}
          connectionUri={connectionUri}
          setConnectionUri={setConnectionUri}
        />
        <DialogFooter className="px-4">
          <Button
            onClick={handleAddConnection}
            disabled={isConnecting || !connectionUri.trim()}
            className="w-full"
          >
            {isConnecting ? t('walletModal.connecting') : t('walletModal.connect')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (isMobile) {
    return (
      <>
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild>
            {children || (
              <Button variant="outline" size="sm" className={className}>
                <Wallet className="h-4 w-4 mr-2" />
                {t('walletModal.walletSettings')}
              </Button>
            )}
          </DrawerTrigger>
          <DrawerContent className="h-full">
            <DrawerHeader className="text-center relative">
              <DrawerClose asChild>
                <Button variant="ghost" size="sm" className="absolute right-4 top-4">
                  <X className="h-4 w-4" />
                  <span className="sr-only">{t('walletModal.close')}</span>
                </Button>
              </DrawerClose>
              <DrawerTitle className="flex items-center justify-center gap-2 pt-2">
                <Wallet className="h-5 w-5" />
                {t('walletModal.lightningWalletTitle')}
              </DrawerTitle>
              <DrawerDescription>
                {t('walletModal.lightningWalletDescription')}
              </DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto">
              <WalletContent {...walletContentProps} />
            </div>
          </DrawerContent>
        </Drawer>
        {/* Render Add Wallet as a separate Drawer for mobile */}
        <Drawer open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{t('walletModal.connectNwcWalletTitle')}</DrawerTitle>
              <DrawerDescription>
                {t('walletModal.connectNwcWalletDescription')}
              </DrawerDescription>
            </DrawerHeader>
            <AddWalletContent
              alias={alias}
              setAlias={setAlias}
              connectionUri={connectionUri}
              setConnectionUri={setConnectionUri}
            />
            <div className="p-4">
              <Button
                onClick={handleAddConnection}
                disabled={isConnecting || !connectionUri.trim()}
                className="w-full"
              >
                {isConnecting ? t('walletModal.connecting') : t('walletModal.connect')}
              </Button>
            </div>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {children || (
            <Button variant="outline" size="sm" className={className}>
              <Wallet className="h-4 w-4 mr-2" />
              {t('walletModal.walletSettings')}
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              {t('walletModal.lightningWalletTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('walletModal.lightningWalletDescription')}
            </DialogDescription>
          </DialogHeader>
          <WalletContent {...walletContentProps} />
        </DialogContent>
      </Dialog>
      {addWalletDialog}
    </>
  );
}