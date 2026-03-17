'use client';

import LockedFeatureView from '../_components/LockedFeatureView';
import BuildIcon from '@mui/icons-material/Build';

export default function MaintenanceLockedPage() {
    return (
        <LockedFeatureView
            title="Maintenance Mode Locked"
            description="The advanced platform maintenance engine allows you to safely perform updates, migrate databases, and release new features without disrupting active user sessions."
            icon={<BuildIcon />}
            price="$149.00 USD"
            imageUrl="/previews/maintenance.png"
            features={[
                "Selective user access during updates",
                "Custom maintenance templates",
                "Automated database snapshots",
                "Scheduled window alerts",
                "Real-time update progress tracking",
                "One-click emergency rollback"
            ]}
        />
    );
}
