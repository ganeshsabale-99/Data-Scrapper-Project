import { motion } from "framer-motion";
import {
    Database,
    Layout,
    Server,
    Shield,
    Users,
    MapPin,
    Building2,
    Briefcase,
    Newspaper,
    CheckCircle2
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export default function ProjectOverviewPage() {
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1 }
    };

    return (
        <div className="p-6 space-y-8 max-w-7xl mx-auto">
            {/* Hero Section */}
            <motion.div
                className="text-center space-y-4 py-8"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    Tech Park Analyzer V2
                </h1>
                <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                    Documentation & Feature Guide for the Team
                </p>
                <div className="flex justify-center gap-2 mt-4">
                    <Badge variant="outline" className="border-blue-500 text-blue-600">v2.0.0</Badge>
                    <Badge variant="outline" className="border-green-500 text-green-600">Production Ready</Badge>
                </div>
            </motion.div>

            <Tabs defaultValue="overview" className="space-y-6">
                <TabsList className="grid w-full grid-cols-4 max-w-2xl mx-auto">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="modules">Key Modules</TabsTrigger>
                    <TabsTrigger value="roles">Roles & Access</TabsTrigger>
                    <TabsTrigger value="architecture">Architecture</TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview">
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="grid md:grid-cols-2 gap-6"
                    >
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Briefcase className="w-5 h-5 text-blue-500" />
                                    Mission
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                                    Tech Park Analyzer is a unified intelligence platform designed to
                                    <strong> aggregate, verify, and operationalize</strong> commercial real estate data.
                                    It solves the problem of fragmented data by providing a "Single Source of Truth"
                                    for Tech Parks, Companies, and Coworking Spaces.
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                                    Core Value Proposition
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-3">
                                    <li className="flex items-start gap-2">
                                        <span className="bg-blue-100 text-blue-700 p-1 rounded-full text-xs mt-1">1</span>
                                        <span><strong>Hyper-Local Data:</strong> Detailed amenities, parking info, and contact details for every Tech Park.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="bg-blue-100 text-blue-700 p-1 rounded-full text-xs mt-1">2</span>
                                        <span><strong>Verified Intelligence:</strong> Field force verification with photo proof and geo-fencing.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="bg-blue-100 text-blue-700 p-1 rounded-full text-xs mt-1">3</span>
                                        <span><strong>Sales Signals:</strong> Integrated funding news to identify growing companies.</span>
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>
                    </motion.div>
                </TabsContent>

                {/* Modules Tab */}
                <TabsContent value="modules">
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="grid md:grid-cols-3 gap-6"
                    >
                        {[
                            {
                                title: "Tech Park Intelligence",
                                icon: Building2,
                                color: "text-indigo-500",
                                desc: "Track parking, security contacts, total floors, and amenities."
                            },
                            {
                                title: "Tenant Mapping",
                                icon: Users,
                                color: "text-purple-500",
                                desc: "Know exactly which companies operate in which building."
                            },
                            {
                                title: "Coworking Spaces",
                                icon: Layout,
                                color: "text-pink-500",
                                desc: "Dedicated module for tracking WeWork, Smartworks, etc."
                            },
                            {
                                title: "Field Operations",
                                icon: MapPin,
                                color: "text-green-500",
                                desc: "Task Assignment and innovative Photo Verification."
                            },
                            {
                                title: "Funding News",
                                icon: Newspaper,
                                color: "text-orange-500",
                                desc: "Daily alerts on companies raising funds (Sales Triggers)."
                            },
                            {
                                title: "Reports & Analytics",
                                icon: Database,
                                color: "text-blue-500",
                                desc: "Visual dashboards for city/state level occupancy and trends."
                            },
                        ].map((module, idx) => (
                            <motion.div key={idx} variants={itemVariants}>
                                <Card className="h-full hover:shadow-lg transition-shadow">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2 text-lg">
                                            <module.icon className={`w-5 h-5 ${module.color}`} />
                                            {module.title}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">{module.desc}</p>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </motion.div>
                </TabsContent>

                {/* Roles Tab */}
                <TabsContent value="roles">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="w-5 h-5 text-red-500" />
                                Role-Based Access Control (RBAC)
                            </CardTitle>
                            <CardDescription>
                                We use a granular permission system. Here is who can do what:
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {[
                                    {
                                        role: "Super Admin",
                                        desc: "Full access to everything. Can manage users, schemas, and system settings."
                                    },
                                    {
                                        role: "Admin",
                                        desc: "Can manage Tech Parks and Users within their Organization. Cannot change system settings."
                                    },
                                    {
                                        role: "Editor (Field Agent)",
                                        desc: "Can view and verify data. Can upload photos and update status. Cannot delete records."
                                    },
                                    {
                                        role: "Viewer (Sales Rep)",
                                        desc: "Read-only access to data and reports. Can view leads and funding news."
                                    }
                                ].map((role, idx) => (
                                    <div key={idx} className="flex items-start gap-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                                        <div className="bg-white dark:bg-slate-800 p-2 rounded-full shadow-sm">
                                            <Users className="w-4 h-4 text-slate-600" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-slate-900 dark:text-slate-100">{role.role}</h3>
                                            <p className="text-sm text-slate-500">{role.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Architecture Tab */}
                <TabsContent value="architecture">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Server className="w-5 h-5 text-slate-500" />
                                System Architecture
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="relative border-l-2 border-slate-200 dark:border-slate-700 ml-4 space-y-8 pl-8 py-4">
                                <div className="relative">
                                    <span className="absolute -left-[41px] bg-blue-500 rounded-full w-6 h-6 border-4 border-white dark:border-slate-950"></span>
                                    <h3 className="font-bold text-lg">Frontend (Client)</h3>
                                    <p className="text-sm text-slate-500">React.js, TailwindCSS, Lucide Icons, Framer Motion.</p>
                                </div>
                                <div className="relative">
                                    <span className="absolute -left-[41px] bg-indigo-500 rounded-full w-6 h-6 border-4 border-white dark:border-slate-950"></span>
                                    <h3 className="font-bold text-lg">Backend (API)</h3>
                                    <p className="text-sm text-slate-500">Node.js, Express, Prisma ORM.</p>
                                </div>
                                <div className="relative">
                                    <span className="absolute -left-[41px] bg-purple-500 rounded-full w-6 h-6 border-4 border-white dark:border-slate-950"></span>
                                    <h3 className="font-bold text-lg">Database</h3>
                                    <p className="text-sm text-slate-500">PostgreSQL (Relational Data).</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
