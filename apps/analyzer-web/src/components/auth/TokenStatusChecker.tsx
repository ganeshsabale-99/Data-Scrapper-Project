import React, { useEffect, useState } from 'react';
import { checkTokenStatus } from '@/lib/auth';
import type { TokenStatusResponse } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const TokenStatusChecker: React.FC = () => {
  const [tokenStatus, setTokenStatus] = useState<TokenStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCheckStatus = async () => {
    setLoading(true);
    try {
      const status = await checkTokenStatus();
      setTokenStatus(status);
    } catch (error) {
      console.error('Error checking token status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleCheckStatus();
  }, []);

  const getStatusColor = (code?: string) => {
    switch (code) {
      case 'TOKEN_EXPIRED':
        return 'destructive';
      case 'TOKEN_INVALID':
        return 'destructive';
      case 'TOKEN_MISSING':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getStatusText = (code?: string) => {
    switch (code) {
      case 'TOKEN_EXPIRED':
        return 'Expired';
      case 'TOKEN_INVALID':
        return 'Invalid';
      case 'TOKEN_MISSING':
        return 'Missing';
      default:
        return 'Valid';
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Token Status
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleCheckStatus}
            disabled={loading}
          >
            {loading ? 'Checking...' : 'Refresh'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tokenStatus ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status:</span>
              <Badge variant={getStatusColor(tokenStatus.code)}>
                {getStatusText(tokenStatus.code)}
              </Badge>
            </div>
            
            {tokenStatus.data && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Expires At:</span>
                  <span className="text-sm text-muted-foreground">
                    {new Date(tokenStatus.data.expiresAt).toLocaleString()}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Time Remaining:</span>
                  <span className="text-sm text-muted-foreground">
                    {tokenStatus.data.timeRemainingFormatted}
                  </span>
                </div>
              </>
            )}
            
            {tokenStatus.details && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive">
                  {tokenStatus.details.message}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Expired at: {new Date(tokenStatus.details.expiredAt).toLocaleString()}
                </p>
              </div>
            )}
            
            <p className="text-sm text-muted-foreground">
              {tokenStatus.message}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Click refresh to check token status
          </p>
        )}
      </CardContent>
    </Card>
  );
};
