export const calculateStatusAnalytics = (entities: any[]) => {
    const total = entities.length;
    const statusCounts: Record<string, number> = {};
    const statuses = [
        "NOT_CONTACTED",
        "CONTACTED",
        "INTERESTED",
        "MEETING_SCHEDULED",
        "PROPOSAL_SENT",
        "IN_PROGRESS",
        "CLOSED",
    ] as const;

    statuses.forEach((status) => {
        statusCounts[status] = entities.filter(
            (e) => (e as any).status === status
        ).length;
    });

    const statusPercentages: Record<string, number> = {};
    Object.entries(statusCounts).forEach(([status, count]) => {
        statusPercentages[status] =
            total > 0 ? Number(((count / total) * 100).toFixed(2)) : 0;
    });

    const contactedCount = total - (statusCounts["NOT_CONTACTED"] || 0);
    const positiveResponseCount =
        (statusCounts["INTERESTED"] || 0) +
        (statusCounts["MEETING_SCHEDULED"] || 0) +
        (statusCounts["PROPOSAL_SENT"] || 0);
    const responseRate =
        contactedCount > 0
            ? Number(((positiveResponseCount / contactedCount) * 100).toFixed(2))
            : 0;

    return {
        total,
        statusCounts,
        statusPercentages,
        contactedCount,
        positiveResponseCount,
        responseRate,
    };
};
