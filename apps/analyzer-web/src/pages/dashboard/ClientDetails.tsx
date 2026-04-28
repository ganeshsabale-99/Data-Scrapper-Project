import { motion } from 'framer-motion';
import { ArrowLeft, Edit, Phone, Mail, MapPin, Building, Star, Globe, Clock, Trash } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent } from '../../components/ui/tooltip';
import { ContactLogs } from '../../components/contact-logs/ContactLogs';

type ClientDetailsRecord = {
  id: string;
  name?: string;
  phone?: string;
  internationalPhone?: string;
  email?: string;
  address?: string;
  website?: string;
  rating?: number;
  total_ratings?: number;
  business_status?: string;
  city?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  _metadata?: {
    rawApiData?: { name?: string };
    normalizedData?: { name?: string };
  };
};

interface ClientDetailsProps {
  client: ClientDetailsRecord;
  onBack: () => void;
  onEdit: (client: ClientDetailsRecord) => void;
  onDelete: (client: ClientDetailsRecord) => void;
}

export function ClientDetails({ client, onBack, onEdit, onDelete }: ClientDetailsProps) {



  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };



  const isLikelyUrl = (val: unknown) => typeof val === 'string' && /^https?:\/\//i.test(val);
  const websiteVal = typeof client.website === 'string' ? client.website : '';

  const infoItems = [
    { icon: Phone, label: 'Phone', value: client.phone || client.internationalPhone || 'N/A' },
    { icon: Mail, label: 'Email', value: client.email || 'N/A' },
    { icon: MapPin, label: 'Address', value: client.address || 'N/A' },
    { icon: Building, label: 'Company Name', value: client.name || client._metadata?.rawApiData?.name || client._metadata?.normalizedData?.name || 'N/A' },
    { icon: Globe, label: 'Website', value: websiteVal || 'N/A', isUrl: isLikelyUrl(websiteVal) },
    { icon: Star, label: 'Rating', value: client.rating ? `${client.rating}/5` : 'N/A' },
    { icon: Clock, label: 'Business Status', value: client.business_status || 'N/A' },
    { icon: MapPin, label: 'City', value: client.city || 'N/A' },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {client.name || client._metadata?.rawApiData?.name || client._metadata?.normalizedData?.name || 'Company Details'}
            </h1>
            <p className="text-muted-foreground">{client.business_status || 'Business Information'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => onEdit(client)}
                className="flex items-center gap-2 px-2 sm:px-4"
                aria-label="Edit client"
              >
                <Edit className="h-4 w-4" />
                <span className="hidden sm:inline">Edit Client</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => onDelete(client)}
                variant="destructive"
                className="flex items-center gap-2 px-2 sm:px-4"
                aria-label="Delete client"
              >
                <Trash className="h-4 w-4" />
                <span className="hidden sm:inline">Delete</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Company Information
                <div className="flex gap-2">
                  <Badge className="bg-blue-100 text-blue-800">
                    {client.business_status || 'Unknown'}
                  </Badge>
                  {client.rating && (
                    <Badge className="bg-green-100 text-green-800">
                      {client.rating}★
                    </Badge>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {infoItems.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <motion.div
                      key={item.label}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center gap-3 p-3 rounded-lg border"
                    >
                      <div className="text-muted-foreground">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-muted-foreground">{item.label}</p>
                        {item.isUrl && typeof item.value === 'string' ? (
                          <a
                            href={item.value}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-blue-700 hover:underline break-words line-clamp-2"
                          >
                            {item.value}
                          </a>
                        ) : (
                          <p className="font-medium break-words">{item.value}</p>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {client.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-line">{client.notes}</p>
              </CardContent>
            </Card>
          )}

          <ContactLogs
            companyId={client.id}
            companyName={client.name || client._metadata?.rawApiData?.name || client._metadata?.normalizedData?.name || "Unknown company"}
            onStatusChange={(_status) => {
            }}
          />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Phone className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold">
                  {client.name || client._metadata?.rawApiData?.name || client._metadata?.normalizedData?.name || 'N/A'}
                </h3>
                <p className="text-sm text-muted-foreground">{client.email || 'N/A'}</p>
                <p className="text-sm text-muted-foreground">{client.phone || client.internationalPhone || 'N/A'}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Client Rating</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                {client.rating && client.rating > 0 ? (
                  <div>
                    <div className="flex items-center justify-center gap-1 mb-2">
                      <Star className="h-6 w-6 fill-yellow-400 text-yellow-400" />
                      <span className="text-2xl font-bold">{client.rating}</span>
                      <span className="text-muted-foreground">/5</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {client.total_ratings ? `${client.total_ratings} reviews` : 'Google rating'}
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="text-muted-foreground mb-2">
                      <Star className="h-8 w-8 mx-auto" />
                    </div>
                    <p className="text-sm text-muted-foreground">No rating available</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Created</span>
                <span className="text-sm font-medium">{formatDate(client.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Last Updated</span>
                <span className="text-sm font-medium">{formatDate(client.updatedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Contact Logs</span>
                <span className="text-sm font-medium">0</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 
