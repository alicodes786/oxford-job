'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { MapPin, Lock, User, Wifi } from 'lucide-react';
import { Listing, BinCollectionItem } from '@/lib/models';
import { BinCollectionSection } from '@/components/listing-profile/BinCollectionSection';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { ListingCalendarFeedsSection } from '@/components/listing-profile/ListingCalendarFeedsSection';

interface OverviewTabProps {
  listing: Listing;
  formData: Partial<Listing>;
  updateFormData: (updates: Partial<Listing>) => void;
  binCollection: BinCollectionItem[];
  onBinCollectionChange: (items: BinCollectionItem[]) => void;
  isAdmin: boolean;
  /** Admin and sub-admin can edit iCal links on the listing profile */
  canEditCalendarFeeds?: boolean;
}

export function OverviewTab({
  listing,
  formData,
  updateFormData,
  binCollection,
  onBinCollectionChange,
  isAdmin,
  canEditCalendarFeeds = false,
}: OverviewTabProps) {
  const [showWifiPassword, setShowWifiPassword] = useState(false);
  
  return (
    <div className="space-y-6">
      {/* 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column */}
        <div className="space-y-6">

          {canEditCalendarFeeds && (
            <ListingCalendarFeedsSection
              listingId={listing.id}
              listingName={listing.name}
              listingColor={listing.color ?? null}
            />
          )}
          
          {/* Address & Location Section (Combined with Landlord) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <MapPin className="h-5 w-5 mr-2" />
                Address & Location
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Address Fields */}
              <div>
                <Label htmlFor="address_line1">Address Line 1 *</Label>
                <Input
                  id="address_line1"
                  value={formData.address_line1 || ''}
                  onChange={(e) => updateFormData({ address_line1: e.target.value })}
                  placeholder="42 Westbourne Gardens"
                />
              </div>
              
              <div>
                <Label htmlFor="address_line2">Address Line 2</Label>
                <Input
                  id="address_line2"
                  value={formData.address_line2 || ''}
                  onChange={(e) => updateFormData({ address_line2: e.target.value })}
                  placeholder="Apartment, suite, etc."
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    value={formData.city || ''}
                    onChange={(e) => updateFormData({ city: e.target.value })}
                    placeholder="London"
                  />
                </div>
                
                <div>
                  <Label htmlFor="postcode">Postcode</Label>
                  <Input
                    id="postcode"
                    value={formData.postcode || ''}
                    onChange={(e) => updateFormData({ postcode: e.target.value })}
                    placeholder="W2 5UR"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="county">County</Label>
                  <Input
                    id="county"
                    value={formData.county || ''}
                    onChange={(e) => updateFormData({ county: e.target.value })}
                    placeholder="Greater London"
                  />
                </div>
                
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Select
                    value={formData.country || 'United Kingdom'}
                    onValueChange={(value) => updateFormData({ country: value })}
                  >
                    <SelectTrigger id="country">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                      <SelectItem value="Ireland">Ireland</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium flex items-center mb-4">
                  <User className="h-4 w-4 mr-2" />
                  Landlord Information
                </h4>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="nature_of_agreement">Nature of Agreement</Label>
                    <Select
                      value={formData.nature_of_agreement || ''}
                      onValueChange={(value) => updateFormData({ nature_of_agreement: value })}
                    >
                      <SelectTrigger id="nature_of_agreement">
                        <SelectValue placeholder="Select agreement type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="R2R">R2R (Rent to Rent)</SelectItem>
                        <SelectItem value="Management">Management</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="landlord_name">Landlord Name *</Label>
                    <Input
                      id="landlord_name"
                      value={formData.landlord_name || ''}
                      onChange={(e) => updateFormData({ landlord_name: e.target.value })}
                      placeholder="Sarah Mitchell"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="landlord_phone">Landlord Phone</Label>
                    <Input
                      id="landlord_phone"
                      type="tel"
                      value={formData.landlord_phone || ''}
                      onChange={(e) => updateFormData({ landlord_phone: e.target.value })}
                      placeholder="+44 7700 900123"
                    />
                    <p className="text-xs text-gray-500 mt-1">More contact details in Finance/Owner tab</p>
                  </div>
                  
                  {isAdmin && (
                    <div className="border-t pt-4 mt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-blue-100 text-blue-800 text-xs">Admin Only</Badge>
                      </div>
                      <Label htmlFor="landlord_commission_percentage">Commission Percentage (%)</Label>
                      <Input
                        id="landlord_commission_percentage"
                        type="number"
                        step="0.5"
                        min="0"
                        max="100"
                        value={formData.landlord_commission_percentage || ''}
                        onChange={(e) => updateFormData({ 
                          landlord_commission_percentage: e.target.value ? parseFloat(e.target.value) : null 
                        })}
                        placeholder="15"
                      />
                    </div>
                  )}
                  
                  <div>
                    <Label htmlFor="landlord_payment_terms">Payment Terms</Label>
                    <Textarea
                      id="landlord_payment_terms"
                      value={formData.landlord_payment_terms || ''}
                      onChange={(e) => updateFormData({ landlord_payment_terms: e.target.value })}
                      placeholder="Monthly payments, due on the 1st of each month..."
                      className="min-h-16"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Property Entry Codes Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <Lock className="h-5 w-5 mr-2" />
                Property Entry Codes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="lock_type">Lock Type</Label>
                <Select
                  value={formData.lock_type || 'keypad'}
                  onValueChange={(value) => updateFormData({ lock_type: value })}
                >
                  <SelectTrigger id="lock_type">
                    <SelectValue placeholder="Select lock type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lockbox">Lockbox</SelectItem>
                    <SelectItem value="smart-lock">Smart Lock</SelectItem>
                    <SelectItem value="physical-key">Physical Key</SelectItem>
                    <SelectItem value="keypad">Keypad</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="access_code">Access Code</Label>
                <Input
                  id="access_code"
                  type="password"
                  value={formData.access_code || ''}
                  onChange={(e) => updateFormData({ access_code: e.target.value })}
                  placeholder="••••"
                />
              </div>
              
              <div>
                <Label htmlFor="access_instructions">Instructions</Label>
                <Textarea
                  id="access_instructions"
                  value={formData.access_instructions || ''}
                  onChange={(e) => updateFormData({ access_instructions: e.target.value })}
                  placeholder="Enter code and turn handle clockwise. Door may stick in humid weather."
                  className="min-h-20"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          
          {/* Wifi & Utilities Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <Wifi className="h-5 w-5 mr-2" />
                Wifi & Utilities
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="wifi_name">WiFi Network Name</Label>
                <Input
                  id="wifi_name"
                  value={formData.wifi_name || ''}
                  onChange={(e) => updateFormData({ wifi_name: e.target.value })}
                  placeholder="MyNetwork_5G"
                />
              </div>
              
              <div>
                <Label htmlFor="wifi_password">WiFi Password</Label>
                <div className="relative">
                  <Input
                    id="wifi_password"
                    type={showWifiPassword ? "text" : "password"}
                    value={formData.wifi_password || ''}
                    onChange={(e) => updateFormData({ wifi_password: e.target.value })}
                    placeholder="••••••••••"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowWifiPassword(!showWifiPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showWifiPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <BinCollectionSection
            items={binCollection}
            onItemsChange={onBinCollectionChange}
            notes={formData.bin_collection_notes || ''}
            onNotesChange={(notes) => updateFormData({ bin_collection_notes: notes })}
          />
        </div>
      </div>
    </div>
  );
}
