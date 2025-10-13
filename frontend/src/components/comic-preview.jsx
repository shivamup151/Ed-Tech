"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
    Save, 
    Download, 
    Trash2, 
    Edit, 
    Eye, 
    Share2, 
    BookOpen, 
    Users, 
    Calendar,
    Palette,
    ChevronLeft,
    ChevronRight,
    Play,
    Pause,
    Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { uploadComicImagesToCloudinaryAndSave, deleteComic, updateComic } from '@/app/(home)/teacher/media-toolkit/comic/action';

const ComicPreview = ({ comic, onSave, onDelete, onEdit, isNew = false }) => {
    const [currentPanel, setCurrentPanel] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (comic && comic.panels && comic.panels.length > 0) {
            // Check if all panels have images
            const hasAllImages = comic.panels.every(panel => panel.imageBase64);
            setIsLoading(!hasAllImages);
        } else {
            setIsLoading(true);
        }
    }, [comic]);

    if (!comic) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No comic to preview</p>
                </div>
            </div>
        );
    }

    // Show loading state if comic is still being generated
    if (isLoading || !comic.panels || comic.panels.length === 0) {
        return (
            <div className="max-w-6xl mx-auto p-6">
                <Card className="shadow-lg border-0">
                    <CardContent className="p-12">
                        <div className="text-center">
                            <div className="flex items-center justify-center mb-6">
                                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600"></div>
                            </div>
                            <h3 className="text-xl font-semibold text-gray-700 mb-2">
                                Generating Your Comic...
                            </h3>
                            <p className="text-gray-500 mb-4">
                                Creating {comic?.numPanels || 4} comic panels with AI-generated images
                            </p>
                            <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>This may take a few moments...</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Convert comic data to the format expected by uploadComicImagesToCloudinaryAndSave
            const comicData = {
                instructions: comic.instruction || comic.instructions,
                subject: comic.subject || "General",
                gradeLevel: comic.grade || comic.gradeLevel,
                numPanels: comic.numPanels || comic.panels.length,
                language: comic.language || "English",
                images: comic.panels.map(panel => {
                    const imageData = panel.imageBase64 || panel.imageUrl;
                    // If it's a data URL, extract base64 part; otherwise use as is
                    return imageData.includes('data:') ? imageData.split(',')[1] : imageData;
                }).filter(Boolean), // Only include valid base64
                comicType: comic.comicType || 'educational'
            };

            // Get user ID from session or pass it as a prop
            const userId = comic.userId || 'current-user'; // This should be passed from parent component
            
            const result = await uploadComicImagesToCloudinaryAndSave(comicData, userId);
            if (result.success) {
                toast.success('Comic saved successfully!');
                onSave?.(result.id);
            } else {
                toast.error(result.error || 'Failed to save comic');
            }
        } catch (error) {
            console.error('Error saving comic:', error);
            toast.error('An error occurred while saving the comic');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!comic._id) {
            toast.error('Cannot delete unsaved comic');
            return;
        }

        if (!confirm('Are you sure you want to delete this comic? This action cannot be undone.')) {
            return;
        }

        setIsDeleting(true);
        try {
            const result = await deleteComic(comic._id);
            if (result.success) {
                toast.success('Comic deleted successfully!');
                onDelete?.(comic._id);
            } else {
                toast.error(result.error || 'Failed to delete comic');
            }
        } catch (error) {
            console.error('Error deleting comic:', error);
            toast.error('An error occurred while deleting the comic');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDownload = async () => {
        try {
            // Download all comic images as individual files
            const imageUrls = comic.panels?.map(panel => panel.imageUrl || panel.imageBase64) || 
                             comic.imageUrls || 
                             comic.images || [];

            if (imageUrls.length === 0) {
                toast.error('No images available for download');
                return;
            }

            // Download each image
            for (let i = 0; i < imageUrls.length; i++) {
                try {
                    const response = await fetch(imageUrls[i]);
                    const blob = await response.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${comic.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_panel_${i + 1}.jpg`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                } catch (error) {
                    console.error(`Error downloading image ${i + 1}:`, error);
                }
            }
            
            toast.success('Comic images downloaded successfully!');
        } catch (error) {
            console.error('Error downloading comic:', error);
            toast.error('Failed to download comic images');
        }
    };

    const nextPanel = () => {
        setCurrentPanel((prev) => (prev + 1) % comic.panels.length);
    };

    const prevPanel = () => {
        setCurrentPanel((prev) => (prev - 1 + comic.panels.length) % comic.panels.length);
    };

    const togglePlay = () => {
        setIsPlaying(!isPlaying);
        // Auto-advance panels every 3 seconds when playing
        if (!isPlaying) {
            const interval = setInterval(() => {
                setCurrentPanel((prev) => (prev + 1) % comic.panels.length);
            }, 3000);
            setTimeout(() => {
                clearInterval(interval);
                setIsPlaying(false);
            }, comic.panels.length * 3000);
        }
    };

    const currentPanelData = comic.panels[currentPanel];

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-purple-50">
                    <CardHeader>
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <CardTitle className="text-2xl font-bold text-gray-900 mb-2">
                                    {comic.title}
                                </CardTitle>
                                <div className="flex flex-wrap gap-2 mb-4">
                                    <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                                        <BookOpen className="h-3 w-3 mr-1" />
                                        {comic.subject}
                                    </Badge>
                                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                                        <Users className="h-3 w-3 mr-1" />
                                        {comic.grade}
                                    </Badge>
                                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                                        <Palette className="h-3 w-3 mr-1" />
                                        {comic.language}
                                    </Badge>
                                    <Badge variant="outline">
                                        {comic.panels.length} panels
                                    </Badge>
                                </div>
                                <p className="text-gray-600 text-sm">
                                    <strong>Topic:</strong> {comic.topic}
                                </p>
                            </div>
                            
                            {/* Action Buttons */}
                            <div className="flex flex-col gap-2">
                                {isNew && (
                                    <Button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="bg-green-600 hover:bg-green-700 text-white"
                                    >
                                        {isSaving ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="h-4 w-4 mr-2" />
                                                Save Comic
                                            </>
                                        )}
                                    </Button>
                                )}
                                
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleDownload}
                                    >
                                        <Download className="h-4 w-4 mr-2" />
                                        Download
                                    </Button>
                                    
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onEdit?.(comic)}
                                    >
                                        <Edit className="h-4 w-4 mr-2" />
                                        Edit
                                    </Button>
                                    
                                    {comic._id && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleDelete}
                                            disabled={isDeleting}
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                        >
                                            {isDeleting ? (
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                                            ) : (
                                                <Trash2 className="h-4 w-4" />
                                            )}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                </Card>
            </motion.div>

            {/* Comic Viewer */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
            >
                <Card className="shadow-lg border-0">
                    <CardContent className="p-6">
                        {/* Panel Navigation */}
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-4">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={prevPanel}
                                    disabled={comic.panels.length <= 1}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                
                                <span className="text-sm font-medium text-gray-600">
                                    Panel {currentPanel + 1} of {comic.panels.length}
                                </span>
                                
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={nextPanel}
                                    disabled={comic.panels.length <= 1}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                                
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={togglePlay}
                                    disabled={comic.panels.length <= 1}
                                >
                                    {isPlaying ? (
                                        <Pause className="h-4 w-4" />
                                    ) : (
                                        <Play className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                            
                            {/* Panel Dots */}
                            <div className="flex gap-2">
                                {comic.panels.map((_, index) => (
                                    <button
                                        key={index}
                                        onClick={() => setCurrentPanel(index)}
                                        className={`w-3 h-3 rounded-full transition-colors ${
                                            index === currentPanel 
                                                ? 'bg-purple-600' 
                                                : 'bg-gray-300 hover:bg-gray-400'
                                        }`}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Current Panel */}
                        {currentPanelData && (
                            <div className="space-y-4">
                                {/* Panel Image */}
                                <div className="flex justify-center">
                                    <div className="relative">
                                        {currentPanelData.imageBase64 ? (
                                            <img
                                                src={`data:image/png;base64,${currentPanelData.imageBase64}`}
                                                alt={`Panel ${currentPanel + 1}`}
                                                className="max-w-full h-auto rounded-lg shadow-lg border border-gray-200"
                                                style={{ maxHeight: '300px' }}
                                                onLoad={() => setIsLoading(false)}
                                            />
                                        ) : (
                                            <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                                                <div className="text-center text-gray-500">
                                                    <Loader2 className="h-12 w-12 mx-auto mb-2 animate-spin" />
                                                    <p>Panel {currentPanel + 1} image</p>
                                                    <p className="text-sm">Generating...</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Panel Prompt */}
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <h4 className="font-semibold text-gray-900 mb-2">
                                        Panel {currentPanel + 1} Description:
                                    </h4>
                                    <p className="text-gray-700 text-sm leading-relaxed">
                                        {currentPanelData.prompt}
                                    </p>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </motion.div>

            {/* Story Prompts */}
            {comic.storyPrompts && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                >
                    <Card className="shadow-lg border-0">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BookOpen className="h-5 w-5 text-purple-600" />
                                Complete Story
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="prose max-w-none">
                                <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-4 rounded-lg border">
                                    {comic.storyPrompts}
                                </pre>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            )}
        </div>
    );
};

export default ComicPreview;
