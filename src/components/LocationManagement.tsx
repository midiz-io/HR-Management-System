import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FaMapMarkerAlt, FaPlus, FaSpinner, FaTrash, FaEdit } from 'react-icons/fa';
import { getCurrentPosition } from '@/util/geofencing';
import { getLocationColor } from '@/lib/locationColors';

interface Location {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radius: number;
}

const LocationManagement: React.FC = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    latitude: '',
    longitude: '',
    radius: '50',
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    address: '',
    latitude: '',
    longitude: '',
    radius: '50',
  });
  const { toast } = useToast();

  // Fetch locations on component mount
  useEffect(() => {
    fetchLocations();
  }, []);

  // Fetch locations from API
  const fetchLocations = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/locations');
      if (!response.ok) {
        throw new Error('Failed to fetch locations');
      }
      const data = await response.json();
      setLocations(data);
    } catch (error) {
      console.error('Error fetching locations:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch locations',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Use current location
  const useCurrentLocation = async () => {
    try {
      const position = await getCurrentPosition();
      setFormData((prev) => ({
        ...prev,
        latitude: position.latitude.toString(),
        longitude: position.longitude.toString(),
      }));
      toast({
        title: 'Success',
        description: 'Current location coordinates set',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to get current location',
      });
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!formData.name || !formData.address || !formData.latitude || !formData.longitude) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please fill in all required fields',
      });
      return;
    }

    try {
      setSubmitting(true);
      
      // Send create location request
      const response = await fetch('/api/locations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          address: formData.address,
          latitude: parseFloat(formData.latitude),
          longitude: parseFloat(formData.longitude),
          radius: parseFloat(formData.radius),
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create location');
      }
      
      toast({
        title: 'Success',
        description: 'Location created successfully',
      });
      
      // Reset form
      setFormData({
        name: '',
        address: '',
        latitude: '',
        longitude: '',
        radius: '50',
      });
      
      // Refresh locations
      fetchLocations();
    } catch (error: any) {
      console.error('Error creating location:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to create location',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle edit button click
  const handleEditClick = (location: Location) => {
    setEditingLocation(location);
    setEditFormData({
      name: location.name,
      address: location.address,
      latitude: location.latitude.toString(),
      longitude: location.longitude.toString(),
      radius: location.radius.toString(),
    });
    setIsEditDialogOpen(true);
  };

  // Handle edit form input changes
  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Use current location for edit form
  const useCurrentLocationForEdit = async () => {
    try {
      const position = await getCurrentPosition();
      setEditFormData((prev) => ({
        ...prev,
        latitude: position.latitude.toString(),
        longitude: position.longitude.toString(),
      }));
      toast({
        title: 'Success',
        description: 'Current location coordinates set',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to get current location',
      });
    }
  };

  // Handle update location
  const handleUpdateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingLocation) return;

    // Validate form
    if (!editFormData.name || !editFormData.address || !editFormData.latitude || !editFormData.longitude) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please fill in all required fields',
      });
      return;
    }

    try {
      setSubmitting(true);
      
      // Send update location request
      const response = await fetch(`/api/locations/${editingLocation.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editFormData.name,
          address: editFormData.address,
          latitude: parseFloat(editFormData.latitude),
          longitude: parseFloat(editFormData.longitude),
          radius: parseFloat(editFormData.radius),
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update location');
      }
      
      toast({
        title: 'Success',
        description: 'Location updated successfully',
      });
      
      // Close dialog and reset
      setIsEditDialogOpen(false);
      setEditingLocation(null);
      
      // Refresh locations
      fetchLocations();
    } catch (error: any) {
      console.error('Error updating location:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update location',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle delete location
  const handleDeleteLocation = async (locationId: string) => {
    if (!confirm('Are you sure you want to delete this location? This action cannot be undone.')) {
      return;
    }

    try {
      setSubmitting(true);
      
      const response = await fetch(`/api/locations/${locationId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete location');
      }
      
      toast({
        title: 'Success',
        description: 'Location deleted successfully',
      });
      
      // Refresh locations
      fetchLocations();
    } catch (error: any) {
      console.error('Error deleting location:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to delete location',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add New Location</CardTitle>
          <CardDescription>
            Create a new office location for attendance tracking
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Location Name</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Headquarters"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="123 Main St, City, Country"
                required
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="latitude">Latitude</Label>
                <Input
                  id="latitude"
                  name="latitude"
                  type="number"
                  step="any"
                  value={formData.latitude}
                  onChange={handleInputChange}
                  placeholder="37.7749"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="longitude">Longitude</Label>
                <Input
                  id="longitude"
                  name="longitude"
                  type="number"
                  step="any"
                  value={formData.longitude}
                  onChange={handleInputChange}
                  placeholder="-122.4194"
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="radius">Geofence Radius (meters)</Label>
              <Input
                id="radius"
                name="radius"
                type="number"
                min="10"
                max="1000"
                value={formData.radius}
                onChange={handleInputChange}
                placeholder="50"
                required
              />
            </div>
            
            <Button
              type="button"
              variant="outline"
              onClick={useCurrentLocation}
              className="w-full"
            >
              <FaMapMarkerAlt className="mr-2 h-4 w-4" />
              Use Current Location
            </Button>
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              disabled={submitting}
              className="w-full"
            >
              {submitting ? (
                <FaSpinner className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FaPlus className="mr-2 h-4 w-4" />
              )}
              Add Location
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Locations</CardTitle>
          <CardDescription>
            Manage your office locations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-4">
              <FaSpinner className="animate-spin h-5 w-5 text-primary" />
            </div>
          ) : locations.length > 0 ? (
            <div className="space-y-4">
              {locations.map((location) => (
                <div key={location.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h4 className="font-medium flex items-center">
                        <span className={`w-3 h-3 rounded-full mr-2 ${getLocationColor(location.name).dot}`} />
                        {location.name}
                      </h4>
                      <p className="text-sm text-muted-foreground ml-5">
                        {location.address}
                      </p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditClick(location)}
                        disabled={submitting}
                      >
                        <FaEdit className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteLocation(location.id)}
                        disabled={submitting}
                      >
                        <FaTrash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="text-muted-foreground font-medium">Coordinates:</span>{' '}
                      {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                    </div>
                    <div>
                      <span className="text-muted-foreground font-medium">Proximity Gate Boundary:</span>{' '}
                      <span className="font-semibold text-primary">{location.radius} meters</span>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-md flex items-center gap-1.5 border border-emerald-200/50 dark:border-emerald-900/30">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Proximity Gate Exit Auto Check-Out Enabled for this radius</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-4 text-muted-foreground">
              No locations found. Add your first location above.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Edit Location Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Update Location</DialogTitle>
            <DialogDescription>
              Update the location details below
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateLocation}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Location Name</Label>
                <Input
                  id="edit-name"
                  name="name"
                  value={editFormData.name}
                  onChange={handleEditInputChange}
                  placeholder="Headquarters"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-address">Address</Label>
                <Input
                  id="edit-address"
                  name="address"
                  value={editFormData.address}
                  onChange={handleEditInputChange}
                  placeholder="123 Main St, City, Country"
                  required
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-latitude">Latitude</Label>
                  <Input
                    id="edit-latitude"
                    name="latitude"
                    type="number"
                    step="any"
                    value={editFormData.latitude}
                    onChange={handleEditInputChange}
                    placeholder="37.7749"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-longitude">Longitude</Label>
                  <Input
                    id="edit-longitude"
                    name="longitude"
                    type="number"
                    step="any"
                    value={editFormData.longitude}
                    onChange={handleEditInputChange}
                    placeholder="-122.4194"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-radius">Geofence Radius (meters)</Label>
                <Input
                  id="edit-radius"
                  name="radius"
                  type="number"
                  min="10"
                  max="1000"
                  value={editFormData.radius}
                  onChange={handleEditInputChange}
                  placeholder="50"
                  required
                />
              </div>
              
              <Button
                type="button"
                variant="outline"
                onClick={useCurrentLocationForEdit}
                className="w-full"
              >
                <FaMapMarkerAlt className="mr-2 h-4 w-4" />
                Use Current Location
              </Button>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
              >
                {submitting ? (
                  <FaSpinner className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FaEdit className="mr-2 h-4 w-4" />
                )}
                Update Location
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LocationManagement;