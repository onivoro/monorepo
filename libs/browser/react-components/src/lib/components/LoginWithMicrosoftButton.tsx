import { Microsoft } from "@mui/icons-material";
import { Button } from "@mui/material";
import { FC } from "react";

export const LoginWithMicrosoftButton: FC<{ login: any }> = ({ login }) => {
    return <Button
        sx={{
            display: 'flex',
            flexDirection: 'row',
            gap: 1,
            transform: 'scale(1.5)'
        }}
        variant='contained'
        onClick={login}
        color='primary'
    >
        <Microsoft /> Sign in with Microsoft
    </Button>
};