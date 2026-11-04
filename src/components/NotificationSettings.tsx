import React, { useState, useEffect } from 'react';
import { useNotifications } from '@/contexts/NotificationContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FaBell, FaBellSlash, FaInfoCircle, FaSpinner, FaExclamationTriangle } from 'react-icons/fa';

const NotificationSettings: React.FC = () => {
  const { 
    isSubscribed, 
    isPushSupported, 
    subscribeToNotifications, 
    unsubscribeFromNotifications,
    sendTestNotification
  } = useNotifications();
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [testLoading, setTestLoading] = useState<boolean>(false);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | null>(null);

  // Check notification permission status
  useEffect(() => {
    if ('Notification' in window) {
      setPermissionStatus(Notification.permission);
    }
  }, [isSubscribed]);

  const handleToggleNotifications = async () => {
    setIsLoading(true);
    try {
      if (isSubscribed) {
        await unsubscribeFromNotifications();
      } else {
        // Request permission first if needed
        if (Notification.permission !== 'granted') {
          const permission = await Notification.requestPermission();
          setPermissionStatus(permission);
          if (permission !== 'granted') {
            throw new Error('Notification permission denied');
          }
        }
        await subscribeToNotifications();
      }
    } catch (error: any) {
      console.error('Error toggling notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestNotification = async () => {
    setTestLoading(true);
    try {
      await sendTestNotification();
    } finally {
      setTestLoading(false);
    }
  };

  if (!isPushSupported) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">Notifications</CardTitle>
          <CardDescription>
            Manage your notification preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <FaBellSlash className="h-4 w-4" />
            <AlertTitle>Not Supported</AlertTitle>
            <AlertDescription>
              Push notifications are not supported in your browser. Please use a modern browser like Chrome, Firefox, or Edge.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl">Notifications</CardTitle>
        <CardDescription>
          Manage your notification preferences
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {permissionStatus === 'denied' && (
          <Alert variant="destructive">
            <FaExclamationTriangle className="h-4 w-4" />
            <AlertTitle>Permission Blocked</AlertTitle>
            <AlertDescription>
              Notifications are blocked in your browser settings. Please enable notifications for this site in your browser settings to receive notifications.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="notifications">Push Notifications</Label>
            <p className="text-sm text-muted-foreground">
              Receive notifications about check-ins, leave requests, and daily reports
            </p>
          </div>
          <Switch
            id="notifications"
            checked={isSubscribed}
            onCheckedChange={handleToggleNotifications}
            disabled={isLoading || permissionStatus === 'denied'}
          />
        </div>

        {isSubscribed ? (
          <div className="pt-2">
            <Alert>
              <FaInfoCircle className="h-4 w-4" />
              <AlertTitle>Notifications Enabled</AlertTitle>
              <AlertDescription>
                You will receive notifications for:
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Employee check-ins and check-outs</li>
                  <li>Leave request submissions and approvals</li>
                  <li>Daily attendance reports</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <div className="pt-2">
            <Alert>
              <FaInfoCircle className="h-4 w-4" />
              <AlertTitle>Enable Notifications</AlertTitle>
              <AlertDescription>
                Toggle the switch above to enable notifications. You may need to allow notifications in your browser when prompted.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>
      {isSubscribed && (
        <CardFooter>
          <Button 
            variant="outline" 
            onClick={handleTestNotification}
            disabled={testLoading}
            className="w-full"
          >
            {testLoading ? (
              <FaSpinner className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FaBell className="mr-2 h-4 w-4" />
            )}
            Send Test Notification
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};

export default NotificationSettings;