"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Copy, Share2, Twitter, Facebook, Mail } from "lucide-react";
import { toast } from "sonner";

interface VulnerableShareProps {
  pollId: string;
  pollTitle: string;
}

export default function VulnerableShare({
  pollId,
  pollTitle,
}: VulnerableShareProps) {
  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Share2 className="h-5 w-5" />
          Sharing Disabled
        </CardTitle>
        <CardDescription>
          Direct sharing links are disabled until tokenized sharing is implemented.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-gray-600">
          For now, please invite collaborators by adding them manually or keep the poll private. Tokenized and expiring share links will be added.
        </div>
      </CardContent>
    </Card>
  );
}
