import { useState } from "react";
import { FileText, FileSpreadsheet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { 
    useOverviewData, 
    useStateWiseData 
} from "@/hooks/use-tech-park-queries";
import {
    useCoworkingSpaceOverviewData,
    useCoworkingSpaceStateWiseData
} from "@/hooks/use-coworking-space-queries";
import {
    useMallOverviewData,
    useMallStateWiseData,
    useHospitalOverviewData,
    useHospitalStateWiseData,
    useStadiumOverviewData,
    useStadiumStateWiseData,
    useAirportOverviewData,
    useAirportStateWiseData,
} from "@/hooks/use-venue-queries";
import { toast } from "sonner";
import { getAuthToken } from "@/lib/token";
import { axiosInstance } from "@/config/axios";

const ENTITY_TYPES = ["all", "techPark", "coworkingSpace", "mall", "hospital", "stadium", "airport"] as const;
type EntityType = typeof ENTITY_TYPES[number];

const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
    all: "All Properties",
    techPark: "Tech Parks",
    coworkingSpace: "Coworking Spaces",
    mall: "Malls",
    hospital: "Hospitals",
    stadium: "Stadiums",
    airport: "Airports",
};

export default function ReportsPage() {
    const [entityType, setEntityType] = useState<EntityType>("all");
    const [status, setStatus] = useState<"all" | "verified" | "unverified">("all");
    const [selectedState, setSelectedState] = useState<string>("all");
    const [selectedCity, setSelectedCity] = useState<string>("all");

    const stateParam = selectedState === "all" ? "" : selectedState;
    const { data: tpOverview } = useOverviewData();
    const { data: tpStateData } = useStateWiseData(stateParam);
    const { data: csOverview } = useCoworkingSpaceOverviewData();
    const { data: csStateData } = useCoworkingSpaceStateWiseData(stateParam);
    const { data: mallOverview } = useMallOverviewData();
    const { data: mallStateData } = useMallStateWiseData(stateParam);
    const { data: hospitalOverview } = useHospitalOverviewData();
    const { data: hospitalStateData } = useHospitalStateWiseData(stateParam);
    const { data: stadiumOverview } = useStadiumOverviewData();
    const { data: stadiumStateData } = useStadiumStateWiseData(stateParam);
    const { data: airportOverview } = useAirportOverviewData();
    const { data: airportStateData } = useAirportStateWiseData(stateParam);

    const genericOverviews = {
        mall: mallOverview,
        hospital: hospitalOverview,
        stadium: stadiumOverview,
        airport: airportOverview,
    } as const;
    const genericStateData = {
        mall: mallStateData,
        hospital: hospitalStateData,
        stadium: stadiumStateData,
        airport: airportStateData,
    } as const;
    const genericKeys = ["mall", "hospital", "stadium", "airport"] as const;

    // Merge states for the dropdown
    const allStates = (() => {
        const statesMap = new Map<string, number>();

        if (entityType === "all" || entityType === "techPark") {
            tpOverview?.stateData?.forEach(s => {
                statesMap.set(s.state, (statesMap.get(s.state) || 0) + s.count);
            });
        }

        if (entityType === "all" || entityType === "coworkingSpace") {
            csOverview?.stateData?.forEach(s => {
                statesMap.set(s.state, (statesMap.get(s.state) || 0) + s.count);
            });
        }

        for (const key of genericKeys) {
            if (entityType === "all" || entityType === key) {
                genericOverviews[key]?.stateData?.forEach(s => {
                    statesMap.set(s.state, (statesMap.get(s.state) || 0) + s.count);
                });
            }
        }

        return Array.from(statesMap.entries())
            .map(([state, count]) => ({ state, count }))
            .sort((a, b) => a.state.localeCompare(b.state));
    })();

    // Merge cities for the selected state
    const allCities = (() => {
        const citiesMap = new Map<string, number>();

        if (entityType === "all" || entityType === "techPark") {
            tpStateData?.cityData?.forEach(c => {
                citiesMap.set(c.city, (citiesMap.get(c.city) || 0) + c.count);
            });
        }

        if (entityType === "all" || entityType === "coworkingSpace") {
            csStateData?.cityData?.forEach(c => {
                citiesMap.set(c.city, (citiesMap.get(c.city) || 0) + c.count);
            });
        }

        for (const key of genericKeys) {
            if (entityType === "all" || entityType === key) {
                genericStateData[key]?.cityData?.forEach(c => {
                    citiesMap.set(c.city, (citiesMap.get(c.city) || 0) + c.count);
                });
            }
        }

        return Array.from(citiesMap.entries())
            .map(([city, count]) => ({ city, count }))
            .sort((a, b) => a.city.localeCompare(b.city));
    })();

    // Calculate total record count preview
    const recordCount = (() => {
        const getTpCount = () => {
            if (selectedState === "all") return tpOverview?.totalTechParks || 0;
            if (selectedCity === "all") return tpStateData?.totalTechParks || 0;
            return tpStateData?.cityData?.find(c => c.city === selectedCity)?.count || 0;
        };

        const getCsCount = () => {
            if (selectedState === "all") return csOverview?.totalCoworkingSpaces || 0;
            if (selectedCity === "all") return csStateData?.totalCoworkingSpaces || 0;
            return csStateData?.cityData?.find(c => c.city === selectedCity)?.count || 0;
        };

        const getGenericCount = (key: typeof genericKeys[number]) => {
            const overview = genericOverviews[key];
            const stateData = genericStateData[key];
            if (selectedState === "all") return overview?.total || 0;
            if (selectedCity === "all") return stateData?.total || 0;
            return stateData?.cityData?.find(c => c.city === selectedCity)?.count || 0;
        };

        if (entityType === "all") {
            return getTpCount() + getCsCount() + genericKeys.reduce((sum, key) => sum + getGenericCount(key), 0);
        }
        if (entityType === "techPark") return getTpCount();
        if (entityType === "coworkingSpace") return getCsCount();
        return getGenericCount(entityType);
    })();

    const isEntityType = (value: string): value is EntityType =>
        (ENTITY_TYPES as readonly string[]).includes(value);

    const isStatus = (value: string): value is "all" | "verified" | "unverified" =>
        value === "all" || value === "verified" || value === "unverified";

    const handleDownload = async (format: "excel" | "csv" | "pdf") => {
        try {
            const token = getAuthToken();
            if (!token) {
                toast.error("Session expired. Please login again.");
                return;
            }

            const params = new URLSearchParams({
                entityType,
                status,
                format,
            });

            if (selectedState !== "all") params.append("state", selectedState);
            if (selectedCity !== "all") params.append("city", selectedCity);

            const response = await axiosInstance.get(`/export?${params.toString()}`, {
                responseType: "blob",
            });

            // Create a blob from the response
            const file = new Blob([response.data], {
                type: format === 'pdf' ? 'application/pdf' : format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });

            // Create a link and click it to download
            const fileURL = URL.createObjectURL(file);
            const link = document.createElement("a");
            link.href = fileURL;
            const extension = format === 'excel' ? 'xlsx' : format;
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            link.setAttribute("download", `report_${entityType}_${timestamp}.${extension}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(fileURL);

            toast.success(`${format.toUpperCase()} report downloaded successfully`);
        } catch (error) {
            console.error("Download failed", error);
            toast.error("Failed to download report");
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                        Reports
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Generate and download reports across all property types.
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Export Options</CardTitle>
                    <CardDescription>
                        Excel downloads include venue details, company counts, and separate sales-ready company sheets for Tech Parks and Coworking Spaces.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="space-y-2">
                            <Label>Property Type</Label>
                            <Select
                                value={entityType}
                                onValueChange={(val) => {
                                    if (isEntityType(val)) setEntityType(val);
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {ENTITY_TYPES.map((type) => (
                                        <SelectItem key={type} value={type}>
                                            {ENTITY_TYPE_LABELS[type]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select
                                value={status}
                                onValueChange={(val) => {
                                    if (isStatus(val)) setStatus(val);
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="verified">Verified</SelectItem>
                                    <SelectItem value="unverified">Unverified</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>State</Label>
                            <Select
                                value={selectedState}
                                onValueChange={(val) => {
                                    setSelectedState(val);
                                    setSelectedCity("all"); // Reset city when state changes
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select state" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All States</SelectItem>
                                    {allStates.map((item) => (
                                        <SelectItem key={item.state} value={item.state}>
                                            {item.state} ({item.count})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>City</Label>
                            <Select
                                value={selectedCity}
                                onValueChange={setSelectedCity}
                                disabled={selectedState === "all"}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select city" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Cities</SelectItem>
                                    {allCities.map((item) => (
                                        <SelectItem key={item.city} value={item.city}>
                                            {item.city} ({item.count})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="pt-4 space-y-4">
                        <div className="flex items-center gap-2">
                            {recordCount > 0 ? (
                                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                    {recordCount.toLocaleString()} {recordCount === 1 ? 'record' : 'records'} will be exported
                                </p>
                            ) : (
                                <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                                    No data available for selected filters
                                </p>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-4">
                            <Button
                                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
                                onClick={() => handleDownload("excel")}
                                disabled={recordCount === 0}
                            >
                                <FileSpreadsheet className="h-4 w-4" />
                                Download Excel
                            </Button>

                            <Button
                                className="flex items-center gap-2"
                                variant="outline"
                                onClick={() => handleDownload("csv")}
                                disabled={recordCount === 0}
                            >
                                <FileText className="h-4 w-4" />
                                Download CSV
                            </Button>
                        </div>
                    </div>

                        {/* <Button
                            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white"
                            onClick={() => handleDownload("pdf")}
                        >
                            <Download className="h-4 w-4" />
                            Download PDF
                        </Button> */}
                </CardContent>
            </Card>
        </div>
    );
}
